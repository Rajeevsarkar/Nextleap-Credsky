/**
 * Serverless proxy for WeatherAPI.com Realtime API.
 * Keeps WEATHER_API_KEY out of the browser (reads it from Vercel env / .env).
 * GET /api/weather?q=<city>
 */
module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const q = ((req.query && req.query.q) || "").trim();

  // F1 guard: never call the upstream API with an empty query (API error 1003).
  if (!q) {
    res.status(400).json({ error: { code: 1003, message: "Enter a city name" } });
    return;
  }

  const key = process.env.WEATHER_API_KEY;
  if (!key) {
    // Server misconfiguration — never leak details to the client.
    res.status(503).json({ error: { code: -1, message: "Weather is temporarily unavailable" } });
    return;
  }

  const url =
    "https://api.weatherapi.com/v1/current.json?key=" +
    encodeURIComponent(key) +
    "&q=" +
    encodeURIComponent(q) +
    "&aqi=no";

  try {
    const upstream = await fetch(url);
    const text = await upstream.text();

    if (upstream.ok) {
      // NFR: cache successful city lookups at the edge for 10 minutes to save quota.
      res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=300");
      res.status(200).send(text);
      return;
    }

    // Map WeatherAPI error codes to clean status codes; pass the JSON body through.
    let code = -1;
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.error) code = parsed.error.code;
    } catch { /* non-JSON upstream error */ }

    // 1003 missing q · 1006 no location · 2007/2008/2010/2011 key-quota issues · 2012 rate limit
    let status;
    if (code === 1003) status = 400;
    else if (code === 1006) status = 404;
    else if ([2006, 2007, 2008, 2010, 2011].includes(code)) status = 503;
    else if (code === 2012) status = 429;
    else status = 502; // provider failure or unknown error (e.g. 9999)

    res.status(status).send(text);
  } catch (err) {
    // Network failure while calling the provider.
    res.status(502).json({ error: { code: -1, message: "Weather is temporarily unavailable" } });
  }
};
