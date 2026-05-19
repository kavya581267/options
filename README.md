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

1. Set in `server/.env`: `KOTAK_ACCESS_TOKEN`, `KOTAK_MOBILE_NUMBER`, `KOTAK_UCC`, plus `TRADING_*` / `SL_*` / `TARGET_*`.
2. On the Kotak page: **Login TOTP** → **Validate MPIN**.
3. Optionally **Use tracker 9:15 anchor** for strike and entry premium, then **Enter straddle**.
4. **Check SL / target** compares live premium and exits when hit (unless using bracket orders).

See [Kotak Neo API v2](https://1q09.github.io/Kotak-neo-api-v2/?theme=light#login-with-totp).

## Notes

- **NIFTY** uses NSE option chain (`nse-bse-api`).
- **SENSEX** uses BSE spot + BSE derivatives option chain. The BSE API often requires running from an **India IP** during market hours; if SENSEX fails, NIFTY collection still continues.
- NSE/BSE rate-limit requests; the collector staggers symbols by ~2s and skips duplicate fetches within 55s.
- Straddle = ATM CE last price + ATM PE last price (closest strike to spot).
- For a database later, replace `server/src/storage.js` with your DB client; API routes can stay the same.
