# SkyCred – Live Weather ⛅

Check the sky's **credit score** before you step out. One screen, one search: current
weather for any city, framed as a playful 0–100 "SkyCred Score" with a clear verdict.

**Live:** https://nextleap-credsky.vercel.app

Data by [WeatherAPI.com](https://www.weatherapi.com/) · Not a real credit score, just vibes.

## What it does
- **Auto-loads Mumbai** on launch (default city), then fetches fresh data on every search.
- **Search any city** (Enter key works) or tap a **Popular Cities** shortcut.
- Shows **temperature °C, feels-like, condition (emoji + text), humidity %, wind kph, UV index**.
- **SkyCred Score (0–100)** with a one-line verdict ("Good to go", "Carry an umbrella"…) —
  inputs shown on the card: feels-like temp, humidity, wind, UV, rain chance.
- **Developer panels**: Formatted JSON + Raw JSON of the exact API response, each with Copy.
- **Error handling**: empty input (no API call), unknown city, offline (auto-retries when
  back online), provider outages, and an 8-second "taking longer than usual" timeout with Retry.
- Shows **region + country** on the result to avoid wrong-city confusion.

## Tech
- Static frontend: `index.html` + `styles.css` + vanilla `app.js` — no frameworks, no build step.
- Serverless proxy: `api/weather.js` (Vercel Node function, zero dependencies).
- The WeatherAPI key lives **only** on the server (`.env` / Vercel env vars) — never shipped to the browser.
- Successful lookups are edge-cached for 10 minutes (`s-maxage=600`) to protect the free-tier quota.

## Run locally
1. `npm i -g vercel` (or use the Vercel CLI of your choice)
2. Copy `.env.example` → `.env` and set `WEATHER_API_KEY=<your WeatherAPI.com key>`
3. `vercel dev` → open the printed localhost URL.

## Deploy
`vercel --prod` (env var `WEATHER_API_KEY` must exist on the Vercel project).

## API
`GET /api/weather?q=<city>` → proxies `https://api.weatherapi.com/v1/current.json`
with `key` and `q` as query parameters, returning the raw JSON response.

| Upstream error code | Status | Client message |
|---|---|---|
| 1003 (missing q) | 400 | "Enter a city name" |
| 1006 (no location) | 404 | "City not found. Check the spelling." |
| 2006/2007/2008/2010/2011 (key/quota) | 503 | "Weather is temporarily unavailable" |
| 2012 (rate limit) | 429 | retry shortly |
| other / network | 502 | friendly retry message |
