# FlyRight Backend

**SerpApi flight search proxy + Shopify membership + fare monitoring for weekly deals**

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  dipstopmarket.com (Shopify)                             │
│  ┌─────────────────────┐  ┌───────────────────────────┐  │
│  │ Embassy polos, mugs  │  │ Cost Constructor Access   │  │
│  │ Great seal gear      │  │ $9.99/30 days             │  │
│  │ Laser-engraved items │  │ $49.99/year               │  │
│  └─────────────────────┘  │ → tags customer on order   │  │
│                            └───────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
          │ Purchase triggers Shopify Flow
          │ → Customer tagged "flyright-member"
          ▼
┌──────────────────────────────────────────────────────────┐
│  FlyRight Backend (this repo)                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ POST /login   │ │ POST /search │ │ Fare Monitor     │ │
│  │ Check Shopify │ │ SerpApi call │ │ Daily scans      │ │
│  │ → issue token │ │ → adapt data │ │ → detect deals   │ │
│  │               │ │ → compliance │ │ → weekly email    │ │
│  └──────────────┘ └──────────────┘ └──────────────────┘ │
└──────────────────────────────────────────────────────────┘
          ▲                    ▲
          │ Bearer token       │ Search results
          │                    │
┌──────────────────────────────────────────────────────────┐
│  FlyRight Frontend (React)                               │
│  flyright.dipstopmarket.com                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ Login screen  │ │ Multi-city   │ │ Compliance       │ │
│  │ Email → token │ │ search UI    │ │ engine + summary │ │
│  └──────────────┘ └──────────────┘ └──────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Install
cd flyright-backend
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your keys (see below)

# 3. Run
npm run dev          # API server (port 3001)
npm run monitor      # One-off fare scan
```

## Shopify Setup (dipstopmarket.com)

### Products

Create TWO products on dipstopmarket.com:
- **Dipstop Cost Constructor — 30-Day Access** ($9.99)
- **Dipstop Cost Constructor — Annual Access** ($49.99)

### Shopify Flows

Create TWO Flows (one per product) that:
1. Trigger on order created
2. Check line item title for "30-Day" or "Annual"
3. Add customer tags: `flyright-member-monthly` or `flyright-member-annual`
4. Add expiry tag: `flyright-expires:YYYY-MM-DD`

### Dev Dashboard App (NOT legacy custom apps)

Legacy custom apps can no longer be created as of January 1, 2026.

1. Go to Shopify admin → Settings → Apps → **Build apps in Dev Dashboard**
2. Create app in Dev Dashboard with scopes: `read_customers`, `read_orders`
3. Release a version → Install on your store
4. Copy **Client ID** and **Client Secret** from app Settings
5. Store as `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` in your environment

The backend uses the OAuth client credentials grant to request access tokens
automatically. Tokens expire every 24 hours and are refreshed transparently.

## API Endpoints

### Authentication

```
POST /api/auth/login
Body: { "email": "user@state.gov" }
Response: { "token": "...", "user": {...}, "expiresIn": 86400 }

GET /api/auth/verify
Headers: Authorization: Bearer <token>
Response: { "valid": true, "user": {...} }
```

### Flight Search

```
POST /api/search/leg
Headers: Authorization: Bearer <token>
Body: {
  "dep": "GRU",
  "arr": "IAD",
  "date": "2026-04-15",
  "flex": 2,
  "cabin": "C",
  "creativeBusinessClass": false
}
Response: {
  "results": [ ...FlyRight flight objects... ],
  "meta": { "resultCount": 24, "rateLimitRemaining": 27 }
}
```

### Deals

```
GET /api/deals/latest        # Public — latest deal scan results
POST /api/deals/scan         # Admin — trigger manual scan
  Headers: x-admin-key: <ADMIN_KEY>
```

## Frontend Integration

Replace the mock `generateLegFlights` function in flyright-v2.jsx with API calls:

```javascript
// In the React component, replace the search handler:

const API_BASE = "https://api.flyright.app"; // or your backend URL

async function searchLegFromAPI(dep, arr, date, flex, cabin, cbc) {
  const token = localStorage.getItem("flyright_token");
  
  const res = await fetch(`${API_BASE}/api/search/leg`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      dep, arr, date, flex, cabin,
      creativeBusinessClass: cbc,
    }),
  });

  if (res.status === 401) {
    // Token expired — redirect to login
    localStorage.removeItem("flyright_token");
    setAuthState("login");
    return [];
  }

  if (res.status === 429) {
    alert("Search limit reached. Please wait before searching again.");
    return [];
  }

  const data = await res.json();
  return data.results || [];
}
```

## Fare Monitor — Deal Detection Strategy

The monitor scans **40 routes × 3 dates = 120 SerpApi calls per run**.

Running daily = ~3,600 calls/month for monitoring alone.
Combined with user searches (~725/month), total ≈ 4,325/month.
Fits within the **$75/month tier** (5,000 searches).

### How Deals Are Detected

1. Each scan records the cheapest business class fare per route
2. Rolling 30-point average is maintained per route
3. A fare **25%+ below the rolling average** triggers a deal alert
4. Deals are aggregated weekly and emailed to all FlyRight members

### Route Coverage

| Region | Routes | Key Cities |
|--------|--------|------------|
| South America | 11 | GRU, BOG, LIM, SCL, EZE, QUI |
| Central America | 3 | PTY, SAL, SJO |
| Africa | 6 | NBO, JNB, ADD, ACC, LOS, DAR |
| Europe | 4 | LHR, CDG, FRA, FCO |
| Asia | 5 | BKK, MNL, DEL, NRT, ICN |
| Middle East | 4 | TLV, AMM, RUH, AUH |
| Gateway routes | 4 | YYZ, YUL, MEX (via Creative Biz) |

### Adding Routes

Edit `MONITORED_ROUTES` in `fare-monitor.js`. Each route needs:
```javascript
{ dep: "XYZ", arr: "JFK", name: "City Name → New York" }
```
Add `gateway: true` for Creative Business Class gateway routes.

## Cost Projections

| Item | Monthly Cost |
|------|-------------|
| SerpApi (5,000 searches) | $75 |
| Hosting (Vercel/Railway) | $0-20 |
| SMTP (Mailgun free tier) | $0 |
| **Total** | **~$80/month** |

| Revenue at scale | Monthly |
|-----------------|---------|
| 100 members | $417 |
| 300 members | $1,250 |
| 500 members | $2,083 |
| 1000 members | $4,166 |

## File Structure

```
flyright-backend/
├── server.js              # Express API server
├── serpapi-adapter.js      # SerpApi → FlyRight data mapper
├── shopify-auth.js         # Membership verification
├── fare-monitor.js         # Deal scanner + email sender
├── package.json
├── .env.example            # Config template
├── price-history.json      # Auto-generated fare data
├── usage-log.json          # Auto-generated usage tracking
└── latest-deals.json       # Auto-generated deal cache
```

## Deployment

Recommended: **Railway** or **Render** (Node.js hosting with cron support)

```bash
# Railway
railway init
railway up

# Or Render: connect GitHub repo, set env vars in dashboard
```

Both support scheduled tasks (for the fare monitor) and persistent file storage.
For production, swap the JSON file storage for a proper database (SQLite minimum, Postgres ideal).
