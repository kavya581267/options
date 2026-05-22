# Straddle Tracker (NIFTY & SENSEX)

Minute-by-minute capture of index spot price and ATM straddle premium from NSE, with a React dashboard for charts, filters, and daily high/low.

## What it does

1. **Scheduler (Node)** — On weekdays from **9:15 AM to 3:30 PM IST**:
   - **9:15**: spot price → pick ATM strike from that spot → record straddle at that strike
   - **Every minute after**: straddle premium at the **same fixed strike** (not re-ATM’d)
2. **Storage** — Appends readings to `server/data/{SYMBOL}/{YYYY-MM-DD}.json` (ready to swap for a DB later).
3. **UI (React)** — Line chart with symbol/date/time filters and day high/low for spot and straddle.

Supports **NIFTY** (NSE) and **SENSEX** (BSE — Sensex options are listed on BSE).

## Quick start

```bash
# Install dependencies
npm run install:all

# Copy env and adjust if needed
cp server/.env.example server/.env

# Run backend + frontend
npm run dev
```

- API: http://localhost:3001  
- UI: http://localhost:5173  

## Daily production run

Keep the server running during market hours (e.g. via `pm2`, `systemd`, or a cron-started process):

```bash
cd server && npm start
```

Or use PM2:

```bash
pm2 start server/src/index.js --name straddle-tracker
pm2 save
```

The cron job runs **Mon–Fri** every minute; market window is enforced in code (9:16–15:30 IST by default).

## Manual / off-hours fetch

For testing when the market is closed:

```bash
# In server/.env
FORCE_FETCH=true

# Or one-off script
cd server && npm run fetch
```

Or click **Fetch now** in the UI (requires `FORCE_FETCH=true` when market is closed).

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Status, symbols, market open flag |
| `GET /api/data/:symbol?date=YYYY-MM-DD` | Day readings + stats |
| `GET /api/dates/:symbol` | Available dates |
| `POST /api/fetch` | Trigger immediate fetch |

## Configuration (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | API port |
| `SYMBOLS` | NIFTY,SENSEX | Comma-separated indices |
| `MARKET_START` | 09:15 | Anchor + market start (IST) |
| `MARKET_END` | 15:30 | End time (IST) |
| `TIMEZONE` | Asia/Kolkata | Scheduler timezone |
| `DATA_DIR` | ./data | JSON storage path |
| `FORCE_FETCH` | false | Fetch outside market hours |

## Data format

```json
{
  "anchor": { "time": "09:15:02", "spot": 24350.5, "strike": 24350, "straddlePremium": 290.35 },
  "readings": [
    {
      "time": "09:16:05",
      "spot": 24355.0,
      "strike": 24350,
      "straddlePremium": 288.10
    }
  ]
}
```

## Kotak Neo (separate page)

Open **Kotak Neo** in the app nav (`/kotak`). This is independent of the straddle tracker chart.

### Strategies

Each broker page has a **Strategies** sidebar. A strategy includes:

- **Name** and **description**
- **Trading parameters** (symbol, side, lots, product, SL/target)
- **Schedule** (IST entry time, auto-enter, monitor interval, tracker anchor)

Only the **active** strategy drives the scheduler and default order settings. Use **+ New** to add another preset (e.g. NIFTY morning vs SENSEX afternoon), **Use this strategy** to activate, **Save strategy** to persist. Data is stored in `server/data/kotak-strategies.json` (or `fyers-strategies.json`). Your old `kotak-trading-config.json` is migrated into a “Default straddle” strategy on first load.

1. Set in `server/.env`: `KOTAK_ACCESS_TOKEN`, `KOTAK_MOBILE_NUMBER`, `KOTAK_UCC` (credentials only).
2. Create or edit a strategy under **Parameters** and **Schedule** tabs; click **Save strategy**.
3. Set **Scheduled entry** time (IST), enable it, and save — at that time the app captures spot → ATM strike → premium; optional auto-enter on Kotak.
4. **Login TOTP** → **Validate MPIN** (required for auto-enter and Kotak live quotes).
5. Optionally **Use tracker 9:15 anchor** or manual **Enter straddle**.
6. Open trades are monitored every 15–60s (configurable, default 30s) for SL/target when Kotak is logged in.
7. **Live quote** panel refreshes while a trade is open.

See [Kotak Neo API v2](https://1q09.github.io/Kotak-neo-api-v2/?theme=light#login-with-totp).

### Whitelist your public IP (required for orders)

Kotak allows **quotes and login** from any IP, but **Place / Cancel order** APIs return `unauthorized (100008)` unless your **public IP is whitelisted** in the Neo Trade API app ([Kotak static IP details](https://www.kotakneo.com/platform/kotak-neo-trade-api/static-ip-details/)).

**Get your public IP** (run on the **same machine** that runs `npm run dev` / `npm start`):

```bash
curl https://api.ipify.org
```

Or open in a browser: **[https://api.ipify.org](https://api.ipify.org)** — you’ll see a single line like `100.52.218.224`. That is the address to whitelist (no `http://`, no port).

**Add it in Kotak Neo:**

1. Neo app → **More** → **Trade API** → your application  
2. **Add IP** / whitelist → paste the IP from api.ipify.org  
3. Save, then **log in again** on the Kotak page (TOTP + MPIN) from the same network  

You can usually register **two IPs** (e.g. home + office). If your ISP changes your IP often, orders will fail again until you update the whitelist or use a **static IP** / cloud server with a fixed IP.

| Symptom | Likely cause |
|---------|----------------|
| Quotes work, orders fail `100008` | IP not whitelisted or session from a different IP than whitelisted |
| `body invalid` on orders | Old bug — orders must use `jData` JSON (fixed in this repo) |
| SENSEX quotes fail | Log in to Kotak; BSE website API is blocked — use Kotak for SENSEX |

## Fyers (separate page)

Open **Fyers** in the app nav (`/fyers`). Same straddle workflow as Kotak Neo, with a separate schedule, config, and trade storage.

1. Create an app at [Fyers API dashboard](https://myapi.fyers.in/dashboard/) and set **Redirect URL** to match `FYERS_REDIRECT_URI` in `server/.env` (e.g. `http://127.0.0.1:5173/`).
2. Set `FYERS_API_KEY`, `FYERS_API_SECRET`, and `FYERS_REDIRECT_URI` in `server/.env`.
3. On the Fyers page: **Get login URL** → sign in → redirect completes login automatically on the Fyers tab.
4. Use **Strategies** (same as Kotak) — stored in `fyers-strategies.json`.
5. **Enter straddle** / **Exit** / SL-target monitor work like Kotak; trades live under `server/data/trades/fyers/`.

See [Fyers API v3 docs](https://myapi.fyers.in/docsv3).

## Notes

- **NIFTY** uses NSE option chain (`nse-bse-api`), or Kotak quotes when logged in.
- **SENSEX** uses **Kotak quotes** when you are logged in (TOTP + MPIN). The BSE public option-chain API is blocked from most servers; without Kotak login, SENSEX tracker data will not collect.
- **Kotak auto-enter** needs IP whitelisting — see [Get your IP](https://api.ipify.org) and the Kotak section above.
- NSE/BSE rate-limit requests; the collector staggers symbols by ~2s and skips duplicate fetches within 55s.
- Straddle = ATM CE last price + ATM PE last price (closest strike to spot).
- For a database later, replace `server/src/storage.js` with your DB client; API routes can stay the same.
