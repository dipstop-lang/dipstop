// ============================================================
// shopify-auth.js
// Verify membership via Shopify Dev Dashboard app
// Uses client credentials grant (OAuth 2.0) — tokens expire every 24h
//
// MEMBERSHIP TIERS:
//   "flyright-member-annual"  → $49.99/year
//   "flyright-member-monthly" → $9.99/30 days
//   "flyright-member"         → legacy catch-all (treated as active)
//
// SHOPIFY SETUP (Dev Dashboard — NOT legacy custom apps):
//   1. Go to https://dev.shopify.com → Create app
//   2. Configure access scopes: read_customers, read_orders
//   3. Release a version → Install on dipstopmarket.com
//   4. Copy Client ID + Client Secret from app Settings
//   5. Store in env: SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
// ============================================================

const SHOPIFY_STORE = process.env.SHOPIFY_STORE || "dipstopmarket.myshopify.com";
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

const MEMBER_TAGS = [
  "flyright-member",
  "flyright-member-annual",
  "flyright-member-monthly",
];

// Simple token signing for user sessions
const SIGNING_SECRET = process.env.SIGNING_SECRET || "flyright-change-this-secret";

// ============================================================
// SHOPIFY ACCESS TOKEN MANAGEMENT
// Client credentials grant — tokens expire every 24 hours
// ============================================================
let shopifyToken = null;
let tokenExpiresAt = 0;

async function getShopifyToken() {
  const now = Date.now();

  // Return cached token if still valid (refresh 5 min early)
  if (shopifyToken && tokenExpiresAt > now + 300000) {
    return shopifyToken;
  }

  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    console.warn("Shopify credentials not configured — running in dev mode");
    return null;
  }

  try {
    const tokenUrl = `https://${SHOPIFY_STORE}/admin/oauth/access_token`;

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
      }).toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Shopify token request failed:", response.status, errText);
      return null;
    }

    const data = await response.json();
    shopifyToken = data.access_token;
    // expires_in is 86399 seconds (24h), convert to ms
    tokenExpiresAt = now + (data.expires_in || 86399) * 1000;

    console.log("Shopify access token refreshed, expires in", data.expires_in, "seconds");
    return shopifyToken;

  } catch (err) {
    console.error("Shopify token refresh failed:", err.message);
    return null;
  }
}

// ============================================================
// USER SESSION TOKENS (issued by our backend)
// ============================================================
function createToken(email, tier = "unknown", expiresIn = 86400) {
  const payload = {
    email,
    tier,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const crypto = require("crypto");
  const sig = crypto.createHmac("sha256", SIGNING_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyToken(token) {
  try {
    const [data, sig] = token.split(".");
    const crypto = require("crypto");
    const expectedSig = crypto.createHmac("sha256", SIGNING_SECRET).update(data).digest("base64url");
    if (sig !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ============================================================
// CHECK MEMBERSHIP
// ============================================================
async function checkMembership(email) {
  const accessToken = await getShopifyToken();

  if (!accessToken) {
    console.warn("No Shopify token — allowing all access (dev mode)");
    return { valid: true, reason: "dev-mode", tier: "dev" };
  }

  try {
    // Search for customer by email using Admin API
    const searchUrl = `https://${SHOPIFY_STORE}/admin/api/2025-01/customers/search.json?query=email:${encodeURIComponent(email)}`;

    const response = await fetch(searchUrl, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // If 401, token may have expired early — force refresh on next call
      if (response.status === 401) {
        shopifyToken = null;
        tokenExpiresAt = 0;
        console.warn("Shopify token expired, will refresh on next request");
      }
      console.error("Shopify API error:", response.status, await response.text());
      return { valid: false, reason: "shopify-error" };
    }

    const data = await response.json();
    const customers = data.customers || [];

    if (customers.length === 0) {
      return { valid: false, reason: "not-found" };
    }

    // Check if any matching customer has a member tag
    for (const customer of customers) {
      const tags = (customer.tags || "").split(",").map(t => t.trim().toLowerCase());

      // Determine tier
      let tier = null;
      if (tags.includes("flyright-member-annual")) tier = "annual";
      else if (tags.includes("flyright-member-monthly")) tier = "monthly";
      else if (tags.includes("flyright-member")) tier = "legacy";

      if (!tier) continue;

      // Check expiry tag: "flyright-expires:YYYY-MM-DD"
      const expiryTag = (customer.tags || "").split(",")
        .map(t => t.trim())
        .find(t => t.toLowerCase().startsWith("flyright-expires:"));

      if (expiryTag) {
        const expiryDate = new Date(expiryTag.split(":").slice(1).join(":"));
        if (expiryDate < new Date()) {
          return { valid: false, reason: "expired", tier };
        }
      }

      return {
        valid: true,
        reason: "active",
        tier,
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
        },
      };
    }

    return { valid: false, reason: "no-membership" };

  } catch (err) {
    console.error("Shopify check failed:", err.message);
    return { valid: false, reason: "error" };
  }
}

// ============================================================
// GET ALL MEMBERS (for deal emails)
// ============================================================
async function getAllMembers() {
  const accessToken = await getShopifyToken();
  if (!accessToken) return [];

  const allMembers = [];

  try {
    for (const tag of MEMBER_TAGS) {
      const url = `https://${SHOPIFY_STORE}/admin/api/2025-01/customers/search.json?query=tag:${encodeURIComponent(tag)}&limit=250`;

      const response = await fetch(url, {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      for (const c of (data.customers || [])) {
        // Check expiry
        const expiryTag = (c.tags || "").split(",")
          .map(t => t.trim())
          .find(t => t.toLowerCase().startsWith("flyright-expires:"));

        if (expiryTag) {
          const expiryDate = new Date(expiryTag.split(":").slice(1).join(":"));
          if (expiryDate < new Date()) continue; // Skip expired
        }

        // Deduplicate by email
        if (!allMembers.find(m => m.email === c.email)) {
          allMembers.push({
            email: c.email,
            firstName: c.first_name,
            lastName: c.last_name,
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch members:", err.message);
  }

  return allMembers;
}

module.exports = {
  checkMembership,
  getAllMembers,
  createToken,
  verifyToken,
  getShopifyToken,
};
