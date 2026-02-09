# Deploying Dipstop Cost Constructor Backend to Railway

Step-by-step guide. No prior Railway or Git experience assumed.

---

## What You're Deploying

A Node.js server that:
- Accepts flight search requests from your frontend
- Calls SerpApi (Google Flights data) and returns compliant results
- Verifies Shopify membership (dipstopmarket.com customers)
- Scans fare deals monthly and emails members

Once deployed, you'll have a live URL like `https://flyright-backend-production.up.railway.app` that your frontend talks to.

---

## Prerequisites

You need three things before starting:

1. **Your SerpApi key** (you already have this)
2. **A GitHub account** (free — https://github.com/signup)
3. **A Railway account** (free tier gives you $5/month — https://railway.com)

---

## Part 1: Get the Code on GitHub

Railway deploys from a GitHub repository. You need to put your backend files there.

### Step 1: Create a GitHub account (skip if you have one)

Go to https://github.com/signup and create a free account.

### Step 2: Create a new repository

1. Go to https://github.com/new
2. Fill in:
   - **Repository name:** `dipstop-cost-constructor-backend`
   - **Description:** `Backend for Dipstop Cost Constructor flight search`
   - **Visibility:** Select **Private** (your code, your API keys reference)
   - **DO NOT** check "Add a README" or ".gitignore" (we already have these)
3. Click **Create repository**
4. You'll see a page with setup instructions — leave this tab open

### Step 3: Upload files to the repository

The simplest method (no Git CLI needed):

1. On your new empty repo page, click the link that says **"uploading an existing file"**
2. Drag and drop ALL of these files from your downloaded backend folder:
   - `server.js`
   - `serpapi-adapter.js`
   - `shopify-auth.js`
   - `fare-monitor.js`
   - `package.json`
   - `railway.json`
   - `.gitignore`
   - `README.md`
3. **DO NOT upload** `.env.example` (it's just a reference for you)
4. **DO NOT upload** `.env` (never put secrets on GitHub)
5. In the "Commit changes" box at the bottom, type: `Initial backend files`
6. Click **Commit changes**

Your code is now on GitHub.

---

## Part 2: Set Up Railway

### Step 4: Create a Railway account

1. Go to https://railway.com
2. Click **Login** → **Login with GitHub**
3. Authorize Railway to access your GitHub account
4. You'll land on the Railway dashboard

### Step 5: Create a new project

1. On the Railway dashboard, click **+ New Project**
2. Select **Deploy from GitHub repo**
3. If prompted, click **Configure GitHub App** and grant Railway access to your `dipstop-cost-constructor-backend` repository (you can select "Only select repositories" and pick just this one)
4. Select your `dipstop-cost-constructor-backend` repository
5. Railway will detect it's a Node.js project and start building — **BUT IT WILL FAIL** because we haven't added environment variables yet. That's fine.

### Step 6: Add environment variables

This is where your API keys go. Railway encrypts these — they never appear in your code.

1. In your Railway project, click on the service card (the purple rectangle showing your repo name)
2. Click the **Variables** tab
3. Click **+ New Variable** for each of the following and add them one by one:

| Variable Name | Value | Notes |
|---------------|-------|-------|
| `SERPAPI_KEY` | Your SerpApi key | The one from serpapi.com/dashboard |
| `PORT` | `3001` | Railway also sets its own PORT, but this is a fallback |
| `ALLOWED_ORIGINS` | `*` | We'll lock this down later when frontend is deployed |
| `MONITOR_CRON` | `0 6 1 * *` | Monthly scan on the 1st at 6am UTC |
| `ADMIN_KEY` | Pick any strong password | For triggering manual fare scans |

**Shopify variables (add these after Part 3 below):**

| Variable Name | Value | Notes |
|---------------|-------|-------|
| `SHOPIFY_STORE` | `dipstopmarket.myshopify.com` | Your Shopify store URL |
| `SHOPIFY_ACCESS_TOKEN` | (from Step 10) | Shopify custom app token |
| `FLYRIGHT_PRODUCT_TAG` | `flyright-member` | Tag applied to paying customers |
| `SIGNING_SECRET` | Pick any long random string | Used to sign login tokens |

4. After adding variables, Railway will automatically redeploy

### Step 7: Generate a public URL

1. In your Railway service, click the **Settings** tab
2. Scroll to **Networking** → **Public Networking**
3. Click **Generate Domain**
4. Railway gives you a URL like: `https://dipstop-cost-constructor-backend-production.up.railway.app`
5. **Copy this URL** — this is your backend address

### Step 8: Test it

Open your browser and go to:
```
https://YOUR-RAILWAY-URL/api/health
```

You should see:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "serpapi": true,
  "shopify": false
}
```

`serpapi: true` means your key is loaded. `shopify: false` is expected until you add the Shopify token.

---

## Part 3: Set Up Shopify (dipstopmarket.com)

### Step 9: Create the FlyRight product

1. Log in to your Shopify admin: https://dipstopmarket.myshopify.com/admin
2. Go to **Products** → **Add product**
3. Fill in:
   - **Title:** `Dipstop Cost Constructor — Annual Access`
   - **Price:** `49.99`
   - **Compare at price:** `99.99` (optional — shows it crossed out)
   - **Uncheck** "This is a physical product" (under Shipping)
   - **Product type:** `Digital`
   - **Tags:** `flyright, digital, membership`
   - **Description:** Write something like:

     > Annual access to the Dipstop Cost Constructor — a Fly America Act
     > compliant flight search tool built for US government travelers.
     >
     > **What you get:**
     > - Search international business class fares across all carriers
     > - Automatic Fly America compliance checking
     > - Creative Business Class routing via Canada/Mexico gateways
     > - Cost construction comparison against your authorized fare
     > - Monthly deal alerts featuring discounted business class fares
     >
     > **Saves 10-20 hours of fare research per trip.**
     >
     > Access is valid for 12 months from date of purchase.

4. Click **Save**

### Step 10: Create a Custom App for the backend

This lets your Railway server check if a customer has paid.

1. In Shopify admin, go to **Settings** → **Apps and sales channels**
2. Click **Develop apps** (top right)
3. If prompted, click **Allow custom app development**
4. Click **Create an app**
   - **App name:** `Dipstop Cost Constructor Backend`
   - Click **Create app**
5. Click **Configure Admin API scopes**
6. Search for and check these scopes:
   - `read_customers`
   - `read_orders` (optional, for future analytics)
7. Click **Save**
8. Click **Install app** → **Install**
9. Click **Reveal token once** under Admin API access token
10. **COPY THIS TOKEN IMMEDIATELY** — Shopify only shows it once
11. Go back to Railway → your service → Variables tab
12. Add `SHOPIFY_ACCESS_TOKEN` with the token you just copied
13. Railway will redeploy automatically

### Step 11: Create a Shopify Flow (auto-tag buyers)

This automatically tags customers as members when they purchase.

1. In Shopify admin, go to **Apps** → search for **Shopify Flow**
   - If not installed, install it (it's free from Shopify)
2. Click **Create workflow**
3. Click **Select a trigger** → choose **Order created**
4. Click the **+** below the trigger → **Add condition**
   - Set: `order` → `lineItems` → `title` → `contains` → `Cost Constructor`
   - Click **Save** on the condition
5. Under the "Then" branch (condition is true), click **+** → **Add action**
   - Search for **Add customer tags**
   - In the tag field, type: `flyright-member`
   - Click **Save**
6. Click **Turn on workflow** (top right)

Now when someone buys the product, they're automatically tagged and the backend will recognize them as a member.

### Step 12: Verify Shopify connection

Open your browser:
```
https://YOUR-RAILWAY-URL/api/health
```

You should now see:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "serpapi": true,
  "shopify": true
}
```

Both `true` — you're fully connected.

---

## Part 4: Test the Full Flow

### Step 13: Test login with your own account

Make sure you've purchased the product yourself (or manually add the `flyright-member` tag to your own customer record in Shopify admin → Customers → find yourself → add tag).

Then test the login endpoint. You can use your browser's developer console or any API tool:

**Using the browser console (press F12 → Console tab):**
```javascript
fetch("https://YOUR-RAILWAY-URL/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "your-email@state.gov" })
})
.then(r => r.json())
.then(d => console.log(d));
```

If your email has the `flyright-member` tag, you'll get back a token. If not, you'll get an error with a link to purchase.

### Step 14: Test a flight search

Using the token from Step 13:
```javascript
fetch("https://YOUR-RAILWAY-URL/api/search/leg", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_TOKEN_FROM_STEP_13"
  },
  body: JSON.stringify({
    dep: "GRU",
    arr: "IAD",
    date: "2026-04-15",
    flex: 0,
    cabin: "C"
  })
})
.then(r => r.json())
.then(d => console.log(d));
```

This burns 1 SerpApi query from your 250/month free tier. You should get back real Google Flights data mapped to the Dipstop Cost Constructor format.

### Step 15: Test a manual deal scan

```
curl -X POST https://YOUR-RAILWAY-URL/api/deals/scan \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

Or in browser console:
```javascript
fetch("https://YOUR-RAILWAY-URL/api/deals/scan", {
  method: "POST",
  headers: { "x-admin-key": "YOUR_ADMIN_KEY" }
})
.then(r => r.json())
.then(d => console.log(d));
```

**WARNING:** A full scan uses ~120 SerpApi queries. On the free tier (250/month), only do this once to test. For regular scanning, you'll need a paid SerpApi plan.

---

## Part 5: Ongoing Maintenance

### Updating your code

When you need to change something:

1. Go to your GitHub repository
2. Click on the file you want to edit
3. Click the pencil icon (edit)
4. Make your changes
5. Click **Commit changes**
6. Railway automatically detects the change and redeploys (takes ~60 seconds)

### Monitoring

- **Railway dashboard** shows logs, CPU usage, and memory
- Click on your service → **Deployments** tab → click any deployment → **View Logs**
- The `/api/admin/stats` endpoint shows usage (requires your admin key)

### Costs

| Service | Free Tier | When You'll Need to Pay |
|---------|-----------|------------------------|
| Railway | $5/month credit (covers small apps) | If usage exceeds ~500 hours/month |
| SerpApi | 250 searches/month | When you have real users (~$75/month for 5,000) |
| GitHub | Unlimited private repos | Never (for this use case) |

Railway's free tier should cover you through proof-of-concept. Once you have paying members, the $49.99/year memberships will vastly exceed your costs.

### Locking down CORS (do this before launch)

Once your frontend is deployed at a real URL, update the `ALLOWED_ORIGINS` variable in Railway from `*` to your actual frontend URL:

```
https://flyright.dipstopmarket.com,https://costconstructor.dipstopmarket.com
```

This prevents other websites from hitting your API.

---

## Quick Reference

| What | Where |
|------|-------|
| Your backend URL | `https://YOUR-RAILWAY-URL` |
| Health check | `https://YOUR-RAILWAY-URL/api/health` |
| Railway dashboard | https://railway.com/dashboard |
| SerpApi dashboard | https://serpapi.com/dashboard |
| Shopify admin | https://dipstopmarket.myshopify.com/admin |
| GitHub repo | https://github.com/YOUR-USERNAME/dipstop-cost-constructor-backend |

---

## Troubleshooting

**"Build failed" on Railway**
→ Check the build logs (click the failed deployment). Usually a missing file or typo. Make sure all 7 files are in the GitHub repo.

**`serpapi: false` on health check**
→ The `SERPAPI_KEY` variable is missing or misspelled in Railway. Go to Variables tab and double-check.

**`shopify: false` after adding token**
→ Check that `SHOPIFY_ACCESS_TOKEN` is the Admin API token (not the Storefront token). Also verify `SHOPIFY_STORE` is set to `dipstopmarket.myshopify.com`.

**Login returns "not-found"**
→ The customer email doesn't exist in Shopify, or the `flyright-member` tag hasn't been applied. Check Shopify admin → Customers.

**Search returns empty results**
→ Check Railway logs. Could be a SerpApi rate limit (250/month free), an invalid airport code, or a date in the past.

**Railway says "no start command"**
→ Make sure `railway.json` is in the repo with `"startCommand": "npm start"`.
