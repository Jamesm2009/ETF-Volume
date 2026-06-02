# ETF Volume Flow Dashboard

Tracks daily ETF share volume vs 30-day average. Deployed on Vercel, data fetched from Yahoo Finance each morning via cron job, cached in Upstash Redis.

## Quick Setup

### 1. Upload to GitHub
Create a new repo and upload all these files. Keep the folder structure exactly as-is.

### 2. Set up Upstash Redis
1. Go to https://upstash.com → create a free Redis database
2. Copy the REST URL and REST Token

### 3. Deploy on Vercel
1. Import your GitHub repo at https://vercel.com/new
2. Add these Environment Variables:
   - `UPSTASH_REDIS_REST_URL` — from Upstash dashboard
   - `UPSTASH_REDIS_REST_TOKEN` — from Upstash dashboard
   - `CRON_SECRET` — any random string (e.g. openssl rand -hex 16)
3. Deploy

### 4. Trigger first data load
After deploy, visit:
```
https://your-app.vercel.app/api/cron
```
This fetches all ETF data immediately. After that, Vercel cron runs it automatically at 9 AM CT on weekdays.

### 5. Change the cron schedule
Edit `vercel.json`. Current schedule: `"0 14 * * 1-5"` = 9 AM CT (14:00 UTC) Mon–Fri.

## Adding / Removing ETFs
Edit `lib/etfs.ts` — add or remove entries from the `ETF_UNIVERSE` array.

## What the Ratio Means
- **≥ 2.0×** 🔴 Very high — unusual activity, potential institutional move
- **≥ 1.5×** 🟠 Elevated — above-normal interest
- **≥ 1.0×** 🟢 Normal-to-high
- **< 0.7×** 🟣 Low — quiet/disinterested

## Direction Arrow
- ↑ Today's volume > yesterday's by >5%
- ↓ Today's volume < yesterday's by >5%
- → Within 5% of yesterday
