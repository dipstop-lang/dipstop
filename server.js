// ============================================================
// server.js — FlyRight Backend
// Express API server: SerpApi proxy, Shopify auth, fare monitor
// ============================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { searchLeg, US_CARRIERS, CODESHARE_MAP } = require("./serpapi-adapter");
const { checkMembership, createToken, verifyToken } = require("./shopify-auth");
const { startScheduler, scanRoutes } = require("./fare-monitor");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const SERPAPI_KEY = process.env.SERPAPI_KEY;

// ============================================================
// MIDDLEWARE
// ============================================================
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",").map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error("CORS blocked"));
  },
  credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing auth token" });
  }
  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.user = payload;
  next();
}

// ============================================================
// RATE LIMITING (simple in-memory)
// ============================================================
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 30; // searches per hour per user

function checkRateLimit(email) {
  const now = Date.now();
  const key = email.toLowerCase();
  const entry = rateLimits.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimits.set(key, { windowStart: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// Clean up rate limits every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW) rateLimits.delete(key);
  }
}, 10 * 60 * 1000);

// ============================================================
// USAGE TRACKING (simple file-based — swap for DB in production)
// ============================================================
const USAGE_FILE = path.join(__dirname, "usage-log.json");

function logUsage(email, action, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    email,
    action,
    ...details,
  };

  let log = [];
  try {
    if (fs.existsSync(USAGE_FILE)) {
      log = JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
    }
  } catch {}

  log.push(entry);

  // Keep last 10k entries
  if (log.length > 10000) log = log.slice(-10000);

  fs.writeFileSync(USAGE_FILE, JSON.stringify(log, null, 2));
}

// ============================================================
// ROUTES
// ============================================================

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    serpapi: !!SERPAPI_KEY,
    shopify: !!process.env.SHOPIFY_ACCESS_TOKEN,
  });
});

// ------------------------------------------------------------
// AUTH: Login — verify Shopify membership, return token
// ------------------------------------------------------------
app.post("/api/auth/login", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const membership = await checkMembership(email.trim().toLowerCase());

    if (!membership.valid) {
      const messages = {
        "not-found": "No account found. Purchase FlyRight access at dipstopmarket.com",
        "no-membership": "Your account doesn't have an active FlyRight membership. Purchase at dipstopmarket.com",
        "expired": "Your FlyRight membership has expired. Renew at dipstopmarket.com",
        "shopify-error": "Unable to verify membership. Please try again.",
        "error": "Unable to verify membership. Please try again.",
      };
      return res.status(403).json({
        error: messages[membership.reason] || "Membership not active",
        reason: membership.reason,
        purchaseUrl: "https://dipstopmarket.com/products/flyright-annual-access",
      });
    }

    // Issue token (24 hour expiry)
    const token = createToken(email.trim().toLowerCase(), 86400);

    logUsage(email, "login");

    res.json({
      token,
      user: membership.customer || { email },
      expiresIn: 86400,
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Verify existing token
app.get("/api/auth/verify", requireAuth, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ------------------------------------------------------------
// SEARCH: Flight search via SerpApi
// ------------------------------------------------------------
app.post("/api/search/leg", requireAuth, async (req, res) => {
  if (!SERPAPI_KEY) {
    return res.status(503).json({ error: "Search API not configured" });
  }

  const { dep, arr, date, flex, cabin, creativeBusinessClass } = req.body;

  // Validate
  if (!dep || !arr || !date) {
    return res.status(400).json({ error: "dep, arr, and date are required" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }

  // Rate limit
  const limit = checkRateLimit(req.user.email);
  if (!limit.allowed) {
    return res.status(429).json({
      error: "Rate limit exceeded. Max 30 searches per hour.",
      retryAfter: 3600,
    });
  }

  try {
    console.log(`Search: ${dep}→${arr} ${date} cabin=${cabin} flex=${flex} cbc=${creativeBusinessClass}`);

    const results = await searchLeg(SERPAPI_KEY, {
      dep,
      arr,
      date,
      flex: Math.min(flex || 0, 3), // Cap flex at ±3 days to control API usage
      cabin: cabin || "Y",
      creativeBusinessClass: creativeBusinessClass || false,
    });

    logUsage(req.user.email, "search", { dep, arr, date, cabin, results: results.length });

    res.json({
      results,
      meta: {
        searchedAt: new Date().toISOString(),
        dep, arr, date,
        resultCount: results.length,
        rateLimitRemaining: limit.remaining,
      },
    });

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed. Please try again." });
  }
});

// ------------------------------------------------------------
// DEALS: Get latest deals (public endpoint for marketing)
// ------------------------------------------------------------
app.get("/api/deals/latest", (req, res) => {
  const dealsFile = path.join(__dirname, "latest-deals.json");
  try {
    if (fs.existsSync(dealsFile)) {
      const deals = JSON.parse(fs.readFileSync(dealsFile, "utf8"));
      res.json({ deals });
    } else {
      res.json({ deals: [] });
    }
  } catch {
    res.json({ deals: [] });
  }
});

// Trigger manual deal scan (admin only — protect this in production)
app.post("/api/deals/scan", async (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Not authorized" });
  }

  try {
    const deals = await scanRoutes();
    fs.writeFileSync(
      path.join(__dirname, "latest-deals.json"),
      JSON.stringify(deals, null, 2)
    );
    res.json({ deals, count: deals.length });
  } catch (err) {
    console.error("Scan error:", err);
    res.status(500).json({ error: "Scan failed" });
  }
});

// ------------------------------------------------------------
// REFERENCE: Carrier and compliance info
// ------------------------------------------------------------
app.get("/api/reference/carriers", (req, res) => {
  res.json({
    usCarriers: US_CARRIERS,
    codeshares: CODESHARE_MAP,
  });
});

// ------------------------------------------------------------
// USAGE STATS (admin)
// ------------------------------------------------------------
app.get("/api/admin/stats", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Not authorized" });
  }

  try {
    let log = [];
    if (fs.existsSync(USAGE_FILE)) {
      log = JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
    }

    const now = new Date();
    const last24h = log.filter(e => (now - new Date(e.ts)) < 86400000);
    const last7d = log.filter(e => (now - new Date(e.ts)) < 7 * 86400000);
    const uniqueUsers24h = new Set(last24h.map(e => e.email)).size;
    const uniqueUsers7d = new Set(last7d.map(e => e.email)).size;
    const searches24h = last24h.filter(e => e.action === "search").length;
    const searches7d = last7d.filter(e => e.action === "search").length;

    res.json({
      total: log.length,
      last24h: { events: last24h.length, users: uniqueUsers24h, searches: searches24h },
      last7d: { events: last7d.length, users: uniqueUsers7d, searches: searches7d },
    });
  } catch {
    res.json({ total: 0 });
  }
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║         FlyRight Backend v1.0.0          ║
  ║──────────────────────────────────────────║
  ║  API:      http://localhost:${PORT}          ║
  ║  SerpApi:  ${SERPAPI_KEY ? "✓ configured" : "✗ missing key"}               ║
  ║  Shopify:  ${process.env.SHOPIFY_ACCESS_TOKEN ? "✓ configured" : "✗ missing (dev mode)"}               ║
  ╚══════════════════════════════════════════╝
  `);

  // Start fare monitor scheduler
  if (process.env.MONITOR_CRON !== "disabled") {
    startScheduler();
  }
});
