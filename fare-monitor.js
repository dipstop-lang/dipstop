// ============================================================
// fare-monitor.js
// Scans business class fares on key routes, detects deals,
// sends monthly email digest to FlyRight members
// (upgrade to weekly/daily once proof of concept is validated)
// ============================================================

require("dotenv").config();
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const { searchFlights, adaptSerpApiResponse, US_CARRIERS } = require("./serpapi-adapter");
const { getAllMembers } = require("./shopify-auth");
const fs = require("fs");
const path = require("path");

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const PRICE_HISTORY_FILE = path.join(__dirname, "price-history.json");

// ============================================================
// MONITORED ROUTES
// Key State Dept overseas posts → US gateway cities in Business
// ============================================================
const MONITORED_ROUTES = [
  // South America
  { dep: "GRU", arr: "MIA", name: "São Paulo → Miami" },
  { dep: "GRU", arr: "JFK", name: "São Paulo → New York" },
  { dep: "GRU", arr: "IAD", name: "São Paulo → Washington" },
  { dep: "GIG", arr: "MIA", name: "Rio → Miami" },
  { dep: "BSB", arr: "MIA", name: "Brasília → Miami" },
  { dep: "BOG", arr: "MIA", name: "Bogotá → Miami" },
  { dep: "BOG", arr: "IAD", name: "Bogotá → Washington" },
  { dep: "LIM", arr: "MIA", name: "Lima → Miami" },
  { dep: "SCL", arr: "MIA", name: "Santiago → Miami" },
  { dep: "EZE", arr: "MIA", name: "Buenos Aires → Miami" },
  { dep: "QUI", arr: "MIA", name: "Quito → Miami" },

  // Central America / Caribbean
  { dep: "PTY", arr: "MIA", name: "Panama City → Miami" },
  { dep: "SAL", arr: "IAD", name: "San Salvador → Washington" },
  { dep: "SJO", arr: "MIA", name: "San José → Miami" },

  // Africa
  { dep: "NBO", arr: "JFK", name: "Nairobi → New York" },
  { dep: "JNB", arr: "JFK", name: "Johannesburg → New York" },
  { dep: "ADD", arr: "IAD", name: "Addis Ababa → Washington" },
  { dep: "ACC", arr: "JFK", name: "Accra → New York" },
  { dep: "LOS", arr: "JFK", name: "Lagos → New York" },
  { dep: "DAR", arr: "JFK", name: "Dar es Salaam → New York" },

  // Europe (Open Skies — more carrier options)
  { dep: "LHR", arr: "IAD", name: "London → Washington" },
  { dep: "CDG", arr: "JFK", name: "Paris → New York" },
  { dep: "FRA", arr: "IAD", name: "Frankfurt → Washington" },
  { dep: "FCO", arr: "JFK", name: "Rome → New York" },

  // Asia
  { dep: "BKK", arr: "JFK", name: "Bangkok → New York" },
  { dep: "MNL", arr: "LAX", name: "Manila → Los Angeles" },
  { dep: "DEL", arr: "JFK", name: "Delhi → New York" },
  { dep: "NRT", arr: "LAX", name: "Tokyo → Los Angeles" },
  { dep: "ICN", arr: "LAX", name: "Seoul → Los Angeles" },
  { dep: "PEK", arr: "JFK", name: "Beijing → New York" },

  // Middle East
  { dep: "TLV", arr: "JFK", name: "Tel Aviv → New York" },
  { dep: "AMM", arr: "JFK", name: "Amman → New York" },
  { dep: "RUH", arr: "IAD", name: "Riyadh → Washington" },
  { dep: "AUH", arr: "JFK", name: "Abu Dhabi → New York" },

  // Gateway routes (Creative Business Class)
  { dep: "GRU", arr: "YYZ", name: "São Paulo → Toronto (Gateway)", gateway: true },
  { dep: "GRU", arr: "YUL", name: "São Paulo → Montreal (Gateway)", gateway: true },
  { dep: "BOG", arr: "MEX", name: "Bogotá → Mexico City (Gateway)", gateway: true },
  { dep: "LIM", arr: "MEX", name: "Lima → Mexico City (Gateway)", gateway: true },
];

// ============================================================
// PRICE HISTORY
// ============================================================
function loadPriceHistory() {
  try {
    if (fs.existsSync(PRICE_HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(PRICE_HISTORY_FILE, "utf8"));
    }
  } catch (e) {
    console.warn("Could not load price history:", e.message);
  }
  return {};
}

function savePriceHistory(history) {
  fs.writeFileSync(PRICE_HISTORY_FILE, JSON.stringify(history, null, 2));
}

function getRouteKey(dep, arr) {
  return `${dep}-${arr}`;
}

function getAverage(prices) {
  if (prices.length === 0) return 0;
  return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
}

// ============================================================
// SCAN ROUTES
// ============================================================
async function scanRoutes() {
  console.log(`[${new Date().toISOString()}] Starting fare scan...`);

  const history = loadPriceHistory();
  const deals = [];
  const today = new Date();

  // Search dates: 2, 4, and 8 weeks out
  const searchDates = [14, 28, 56].map(days => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  });

  for (const route of MONITORED_ROUTES) {
    const key = getRouteKey(route.dep, route.arr);
    if (!history[key]) history[key] = { prices: [], lastScan: null };

    for (const searchDate of searchDates) {
      try {
        console.log(`  Scanning ${route.name} on ${searchDate}...`);

        const serpData = await searchFlights(SERPAPI_KEY, {
          depAirport: route.dep,
          arrAirport: route.arr,
          date: searchDate,
          cabin: 3, // Business class
        });

        const results = adaptSerpApiResponse(serpData, { searchDate });

        if (results.length > 0) {
          // Get cheapest compliant fare
          const compliant = results.filter(r => r.compliance.compliant);
          const cheapest = (compliant.length > 0 ? compliant : results)
            .sort((a, b) => a.totalPrice - b.totalPrice)[0];

          const price = cheapest.totalPrice;

          // Record price
          history[key].prices.push({
            date: searchDate,
            scanned: today.toISOString(),
            price,
            carrier: cheapest.segments.map(s => s.mktCx).join("/"),
            compliant: cheapest.compliance.compliant,
          });

          // Keep last 90 data points per route
          if (history[key].prices.length > 90) {
            history[key].prices = history[key].prices.slice(-90);
          }
          history[key].lastScan = today.toISOString();

          // Detect deal: >25% below rolling average
          const recentPrices = history[key].prices
            .slice(-30)
            .map(p => p.price);
          const avg = getAverage(recentPrices);

          if (avg > 0 && price < avg * 0.75) {
            const savings = avg - price;
            const pctOff = Math.round((1 - price / avg) * 100);

            deals.push({
              route: route.name,
              dep: route.dep,
              arr: route.arr,
              price,
              avgPrice: avg,
              savings,
              pctOff,
              date: searchDate,
              carrier: cheapest.segments.map(s => `${s.mktCx} (${s.airline})`).join(" → "),
              stops: cheapest.stops,
              compliant: cheapest.compliance.compliant,
              isGateway: route.gateway || false,
            });

            console.log(`  🔥 DEAL: ${route.name} $${price} (${pctOff}% below avg $${avg})`);
          }
        }

        // Rate limit: wait between API calls
        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        console.warn(`  ✕ Failed ${route.name} on ${searchDate}: ${err.message}`);
      }
    }
  }

  savePriceHistory(history);
  console.log(`[${new Date().toISOString()}] Scan complete. ${deals.length} deals found.`);

  return deals;
}

// ============================================================
// EMAIL TEMPLATE
// ============================================================
function buildDealEmail(deals) {
  if (deals.length === 0) return null;

  // Sort by savings percentage
  deals.sort((a, b) => b.pctOff - a.pctOff);

  const dealRows = deals.map(d => `
    <tr style="border-bottom:1px solid #1e293b;">
      <td style="padding:14px 12px;">
        <div style="font-weight:700;color:#e2e8f0;font-size:14px;">${d.route}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px;">${d.carrier}</div>
        <div style="font-size:11px;color:#64748b;">
          ${d.stops === 0 ? "Nonstop" : d.stops + " stop" + (d.stops > 1 ? "s" : "")}
          ${d.compliant ? ' · <span style="color:#4ade80;">✓ Fly America</span>' : ' · <span style="color:#fbbf24;">Check compliance</span>'}
          ${d.isGateway ? ' · <span style="color:#c084fc;">Gateway route</span>' : ""}
        </div>
      </td>
      <td style="padding:14px 12px;text-align:center;">
        <div style="font-size:10px;color:#64748b;text-decoration:line-through;">$${d.avgPrice.toLocaleString()}</div>
        <div style="font-size:22px;font-weight:800;color:#c2850c;">$${d.price.toLocaleString()}</div>
      </td>
      <td style="padding:14px 12px;text-align:center;">
        <div style="background:#065f46;color:#4ade80;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;display:inline-block;">
          ${d.pctOff}% off
        </div>
        <div style="font-size:11px;color:#4ade80;margin-top:4px;">Save $${d.savings.toLocaleString()}</div>
      </td>
      <td style="padding:14px 12px;text-align:center;font-size:12px;color:#94a3b8;">
        ${d.date}
      </td>
    </tr>
  `).join("");

  return {
    subject: `✈️ FlyRight Deals: ${deals.length} Business Class Fare${deals.length > 1 ? "s" : ""} — Up to ${deals[0].pctOff}% Off`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#04080f;color:#c9d1d9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    
    <div style="text-align:center;padding:24px 0;">
      <div style="font-size:28px;font-weight:800;color:#c2850c;letter-spacing:0.02em;">FlyRight</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Monthly Business Class Deals</div>
    </div>

    <div style="background:#0b1120;border:1px solid rgba(148,163,184,0.1);border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:rgba(194,133,12,0.08);">
            <th style="padding:10px 12px;text-align:left;font-size:10px;color:#c2850c;text-transform:uppercase;letter-spacing:0.05em;">Route</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;color:#c2850c;text-transform:uppercase;letter-spacing:0.05em;">Price</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;color:#c2850c;text-transform:uppercase;letter-spacing:0.05em;">Savings</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;color:#c2850c;text-transform:uppercase;letter-spacing:0.05em;">Date</th>
          </tr>
        </thead>
        <tbody>
          ${dealRows}
        </tbody>
      </table>
    </div>

    <div style="text-align:center;padding:24px 0;">
      <a href="https://flyright.dipstopmarket.com" 
         style="display:inline-block;background:linear-gradient(135deg,#c2850c,#a06b04);color:#04080f;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:700;font-size:14px;">
        Build Your Itinerary in FlyRight →
      </a>
      <div style="font-size:11px;color:#475569;margin-top:12px;">
        Found a deal? Use FlyRight to build your compliant routing and cost construction before requesting through your TMC.
      </div>
    </div>

    <div style="border-top:1px solid #1e293b;padding-top:16px;text-align:center;">
      <div style="font-size:10px;color:#475569;">
        Fares are as of scan time and may change. Always verify with your Travel Management Company before booking.
        <br>Fly America compliance indicators are estimates — confirm with your travel office.
      </div>
      <div style="font-size:10px;color:#475569;margin-top:8px;">
        <a href="https://dipstopmarket.com" style="color:#c2850c;">Dipstop Market</a> · 
        <a href="mailto:support@dipstopmarket.com" style="color:#c2850c;">Contact</a> · 
        <a href="#" style="color:#64748b;">Unsubscribe</a>
      </div>
    </div>

  </div>
</body>
</html>
    `,
  };
}

// ============================================================
// SEND DEAL EMAILS
// ============================================================
async function sendDeals(deals) {
  if (!deals || deals.length === 0) {
    console.log("No deals to send.");
    return;
  }

  const email = buildDealEmail(deals);
  if (!email) return;

  // Get member list from Shopify
  const members = await getAllMembers();

  if (members.length === 0) {
    console.log("No members to email. Saving deals to file.");
    fs.writeFileSync(
      path.join(__dirname, "latest-deals.json"),
      JSON.stringify(deals, null, 2)
    );
    return;
  }

  // Configure mailer
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Send to each member (batch in production — use BCC or email service)
  let sent = 0;
  for (const member of members) {
    try {
      await transporter.sendMail({
        from: `"FlyRight Deals" <${process.env.DEALS_FROM}>`,
        replyTo: process.env.DEALS_REPLY_TO,
        to: member.email,
        subject: email.subject,
        html: email.html.replace("{{FIRST_NAME}}", member.firstName || "Traveler"),
      });
      sent++;
    } catch (err) {
      console.error(`Failed to email ${member.email}:`, err.message);
    }
  }

  console.log(`Sent deals to ${sent}/${members.length} members.`);
}

// ============================================================
// MAIN: Run as cron job or standalone
// ============================================================
async function runMonitor() {
  const deals = await scanRoutes();
  await sendDeals(deals);
}

// If run directly: execute once
if (require.main === module) {
  runMonitor().catch(console.error);
}

// If imported: set up cron schedule
function startScheduler() {
  const schedule = process.env.MONITOR_CRON || "0 6 * * *";
  console.log(`Fare monitor scheduled: ${schedule}`);
  cron.schedule(schedule, () => {
    runMonitor().catch(console.error);
  });
}

module.exports = { runMonitor, startScheduler, scanRoutes, sendDeals };
