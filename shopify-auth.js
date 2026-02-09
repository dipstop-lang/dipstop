// ============================================================
// shopify-auth.js
// Verify FlyRight membership via Shopify Customer API
// ============================================================
//
// STRATEGY:
// 1. User buys "FlyRight Annual Access" ($49.99) on dipstopmarket.com
// 2. Shopify order triggers a Flow that tags the customer: "flyright-member"
// 3. When user accesses FlyRight, they enter their email
// 4. Backend checks Shopify for a customer with that email + active tag
// 5. Returns a session token (simple JWT or signed cookie)
//
// SHOPIFY SETUP NEEDED:
// - Create a "FlyRight Annual Access" product ($49.99)
// - Create a Shopify Flow: When order placed → if line item = FlyRight product
//   → add customer tag "flyright-member"
// - Create a Custom App with customer read scope
// - Optional: Use Shopify subscription/recurring billing for auto-renewal
//
// ALTERNATIVE: Shopify Multipass (Shopify Plus only) for seamless SSO
// ============================================================

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const MEMBER_TAG = process.env.FLYRIGHT_PRODUCT_TAG || "flyright-member";

// Simple token signing (in production, use jsonwebtoken with a real secret)
const SIGNING_SECRET = process.env.SIGNING_SECRET || "flyright-change-this-secret";

function createToken(email, expiresIn = 86400) {
  const payload = {
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  };
  // Simple base64 encoding — swap for proper JWT in production
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
// Check Shopify for active membership
// ============================================================
async function checkMembership(email) {
  if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
    console.warn("Shopify not configured — allowing all access (dev mode)");
    return { valid: true, reason: "dev-mode" };
  }

  try {
    // Search for customer by email
    const searchUrl = `https://${SHOPIFY_STORE}/admin/api/2024-10/customers/search.json?query=email:${encodeURIComponent(email)}`;

    const response = await fetch(searchUrl, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Shopify API error:", response.status, await response.text());
      return { valid: false, reason: "shopify-error" };
    }

    const data = await response.json();
    const customers = data.customers || [];

    if (customers.length === 0) {
      return { valid: false, reason: "not-found" };
    }

    // Check if any matching customer has the member tag
    const member = customers.find(c => {
      const tags = (c.tags || "").split(",").map(t => t.trim().toLowerCase());
      return tags.includes(MEMBER_TAG.toLowerCase());
    });

    if (!member) {
      return { valid: false, reason: "no-membership" };
    }

    // Optional: check if membership has expired
    // You could add an expiry tag like "flyright-expires:2027-02-09"
    const expiryTag = (member.tags || "").split(",")
      .map(t => t.trim())
      .find(t => t.startsWith("flyright-expires:"));

    if (expiryTag) {
      const expiryDate = new Date(expiryTag.split(":")[1]);
      if (expiryDate < new Date()) {
        return { valid: false, reason: "expired" };
      }
    }

    return {
      valid: true,
      reason: "active",
      customer: {
        id: member.id,
        email: member.email,
        firstName: member.first_name,
        lastName: member.last_name,
      },
    };

  } catch (err) {
    console.error("Shopify check failed:", err.message);
    return { valid: false, reason: "error" };
  }
}

// ============================================================
// Get all active FlyRight members (for deal emails)
// ============================================================
async function getAllMembers() {
  if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
    return [];
  }

  try {
    // Fetch customers tagged as members
    const url = `https://${SHOPIFY_STORE}/admin/api/2024-10/customers/search.json?query=tag:${encodeURIComponent(MEMBER_TAG)}&limit=250`;

    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.customers || []).map(c => ({
      email: c.email,
      firstName: c.first_name,
      lastName: c.last_name,
    }));

  } catch (err) {
    console.error("Failed to fetch members:", err.message);
    return [];
  }
}

module.exports = {
  checkMembership,
  getAllMembers,
  createToken,
  verifyToken,
};
