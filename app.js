/* SkyCred – Live Weather. Data: WeatherAPI.com via /api/weather (key stays server-side). */
"use strict";

const POPULAR_CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Kolkata", "Chennai", "Hyderabad",
  "London", "New York", "Tokyo", "Dubai", "Singapore", "Paris",
];

const $ = (id) => document.getElementById(id);
const els = {
  form: $("search-form"),
  input: $("city-input"),
  status: $("status"),
  card: $("weather-card"),
  cityName: $("city-name"),
  cityRegion: $("city-region"),
  updated: $("updated"),
  scoreValue: $("score-value"),
  scoreRing: $("score-ring"),
  verdict: $("verdict"),
  scoreInputs: $("score-inputs"),
  temp: $("temp"),
  feels: $("feels"),
  emoji: $("emoji"),
  condText: $("cond-text"),
  humidity: $("humidity"),
  wind: $("wind"),
  uv: $("uv"),
  jsonFormatted: $("json-formatted"),
  jsonRaw: $("json-raw"),
  copyFormatted: $("copy-formatted"),
  copyRaw: $("copy-raw"),
  chips: $("popular-cities"),
};

let lastQuery = "Mumbai"; // Default city: Mumbai loads on launch
let lastRawText = null;
let chips = [];

/* ---------- Popular cities ---------- */
function renderChips() {
  els.chips.innerHTML = "";
  chips = POPULAR_CITIES.map((city) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = city;
    btn.addEventListener("click", () => {
      els.input.value = city;
      fetchWeather(city);
    });
    els.chips.appendChild(btn);
    return btn;
  });
}

function markActiveChip(city) {
  chips.forEach((c) => c.classList.toggle("active", c.textContent.toLowerCase() === city.toLowerCase()));
}

/* ---------- Status banner ---------- */
function showStatus(message, kind, retry) {
  els.status.hidden = false;
  els.status.classList.toggle("error", kind === "error");
  els.status.textContent = message;
  if (retry) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "retry-btn";
    btn.textContent = "Retry";
    btn.addEventListener("click", () => fetchWeather(lastQuery));
    els.status.appendChild(btn);
  }
}

function hideStatus() {
  els.status.hidden = true;
  els.status.textContent = "";
}

/* ---------- Loading state ---------- */
function setLoading() {
  hideStatus();
  els.card.classList.add("loading-shimmer");
  [els.cityName, els.temp, els.feels, els.emoji, els.condText, els.humidity, els.wind, els.uv,
   els.scoreValue, els.verdict].forEach((el) => (el.textContent = "--"));
  els.cityRegion.innerHTML = "&nbsp;";
  els.updated.textContent = "Updated: --";
  els.scoreInputs.textContent = "";
  els.scoreRing.style.strokeDashoffset = 327;
  els.jsonFormatted.textContent = "--";
  els.jsonRaw.textContent = "--";
  const first = els.cityName;
  showStatus("Fetching weather…");
  first.focus({ preventScroll: true });
}

/* ---------- Error messages (plain language, no raw codes) ---------- */
function showError(status, upstreamMessage) {
  els.card.classList.remove("loading-shimmer");
  let msg;
  if (!navigator.onLine) {
    msg = "You appear to be offline. Check your connection and retry.";
  } else if (status === "slow") {
    msg = "Taking longer than usual. Retry?";
  } else if (status === "empty") {
    msg = "Enter a city name";
  } else if (status === 404) {
    msg = "City not found. Check the spelling.";
  } else if (status === 503 || status === 429) {
    msg = "Weather is temporarily unavailable. Please try again shortly.";
  } else if (status === "network") {
    msg = "Could not reach the weather service. Retry?";
  } else {
    msg = upstreamMessage || "Something went wrong while fetching the weather. Retry?";
  }
  showStatus(msg, "error", !navigator.onLine || status !== "empty");
}

/* ---------- SkyCred score (0–100, theme only — not a real credit score) ---------- */
function skyScore(c) {
  const feels = Number.isFinite(c.feelslike_c) ? c.feelslike_c : c.temp_c;
  const hum = Number.isFinite(c.humidity) ? c.humidity : 0;
  const uv = Number.isFinite(c.uv) ? c.uv : 0;
  const wind = Number.isFinite(c.wind_kph) ? c.wind_kph : 0;
  const rain = Number.isFinite(c.chance_of_rain) ? c.chance_of_rain : 0;

  let s = 100;
  s -= Math.min(35, Math.abs(feels - 24) * 2.2);  // temperature comfort (ideal ~24°C)
  s -= Math.max(0, hum - 60) * 0.5;               // muggy air
  s -= Math.max(0, uv - 2) * 5;                   // sun safety
  s -= Math.max(0, wind - 15) * 0.8;              // blustery
  s -= Math.max(0, rain - 10) * 0.4;              // wet
  return Math.max(0, Math.min(100, Math.round(s)));
}

function verdictFor(score) {
  if (score >= 80) return { text: "Great day to go out 🎉", color: "var(--good)" };
  if (score >= 60) return { text: "Good to go ✅", color: "var(--good)" };
  if (score >= 40) return { text: "Be prepared — check the details 🧥", color: "var(--warn)" };
  if (score >= 20) return { text: "Think twice before heading out 🤔", color: "var(--warn)" };
  return { text: "Better to stay in 🙃", color: "var(--bad)" };
}

const RING_LEN = 2 * Math.PI * 52; // ≈ 326.7

function renderScore(c) {
  const score = skyScore(c);
  const v = verdictFor(score);
  els.scoreValue.textContent = String(score);
  els.scoreRing.style.stroke = v.color;
  els.scoreRing.style.strokeDashoffset = String(RING_LEN * (1 - score / 100));
  els.verdict.textContent = v.text;
  els.scoreInputs.textContent = "Inputs: feels-like temp, humidity, wind, UV, rain chance";
}

/* ---------- Emoji + condition ---------- */
function weatherEmoji(condText, isDay) {
  const t = (condText || "").toLowerCase();
  if (/thunder|storm/.test(t)) return "⛈️";
  if (/snow|sleet|blizzard|ice/.test(t)) return "❄️";
  if (/fog|mist|haze|smoke|dust|sand/.test(t)) return "🌫️";
  if (/heavy|rain|shower|drizzle/.test(t)) return "🌧️";
  if (/cloud|overcast|patchy/.test(t)) return "☁️";
  if (/wind|breeze|gale/.test(t)) return "💨";
  if (/clear|sunny/.test(t)) return isDay ? "☀️" : "🌙";
  return isDay ? "🌤️" : "🌙";
}

/* ---------- Render ---------- */
function renderResult(data, rawText) {
  hideStatus();
  els.card.classList.remove("loading-shimmer");
  lastRawText = rawText;

  const loc = data.location || {};
  const cur = data.current || {};
  const cond = (cur.condition && cur.condition.text) || "--";
  const isDay = cur.is_day === 1;

  els.cityName.textContent = loc.name || "--";
  const region = [loc.region, loc.country].filter(Boolean).join(", ");
  els.cityRegion.textContent = region || "\u00a0";
  els.updated.textContent = "Updated: " + (cur.last_updated || "--");

  els.temp.textContent = fmt(cur.temp_c);
  els.feels.textContent = fmt(cur.feelslike_c);
  els.emoji.textContent = weatherEmoji(cur.condition && cur.condition.text, isDay);
  els.condText.textContent = cond;
  els.humidity.textContent = fmt(cur.humidity);
  els.wind.textContent = fmt(cur.wind_kph);
  els.uv.textContent = fmt(cur.uv);

  renderScore(cur);

  try {
    els.jsonFormatted.textContent = JSON.stringify(data, null, 2);
  } catch {
    els.jsonFormatted.textContent = rawText;
  }
  els.jsonRaw.textContent = rawText;

  markActiveChip(loc.name || lastQuery);
}

function fmt(v) {
  return Number.isFinite(v) ? String(v) : "--";
}

/* ---------- Fetch ---------- */
async function fetchWeather(city) {
  const q = (city || "").trim();
  if (!q) {
    lastQuery = lastQuery || "Mumbai";
    showError("empty");
    return;
  }
  if (!navigator.onLine) {
    showError("offline");
    return;
  }
  lastQuery = q;
  setLoading();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000); // 8s guard
  try {
    const res = await fetch("/api/weather?q=" + encodeURIComponent(q), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const rawText = await res.text();
    if (!res.ok) {
      let upstreamMsg = null;
      try {
        const j = JSON.parse(rawText);
        if (j && j.error && j.error.message) upstreamMsg = j.error.message;
      } catch { /* keep null */ }
      showError(res.status, upstreamMsg);
      if (lastRawText) renderJsonOnly(); // keep the previous result's JSON panels
      return;
    }
    const data = JSON.parse(rawText);
    renderResult(data, rawText);
  } catch (err) {
    clearTimeout(timer);
    if (err && err.name === "AbortError") showError("slow");
    else showError("network");
  }
}

function renderJsonOnly() {
  try {
    els.jsonFormatted.textContent = JSON.stringify(JSON.parse(lastRawText), null, 2);
  } catch {
    els.jsonFormatted.textContent = lastRawText;
  }
  els.jsonRaw.textContent = lastRawText;
}

/* ---------- Copy buttons ---------- */
async function copyText(btn, getText) {
  try {
    await navigator.clipboard.writeText(getText());
  } catch {
    const ta = document.createElement("textarea");
    ta.value = getText();
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const old = btn.textContent;
  btn.textContent = "Copied ✓";
  setTimeout(() => (btn.textContent = old), 1500);
}

/* ---------- Events ---------- */
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  fetchWeather(els.input.value);
});

els.copyFormatted.addEventListener("click", () =>
  copyText(els.copyFormatted, () => els.jsonFormatted.textContent));
els.copyRaw.addEventListener("click", () =>
  copyText(els.copyRaw, () => els.jsonRaw.textContent));

// Auto-retry once the connection is back
window.addEventListener("online", () => {
  if (!els.status.hidden && els.status.classList.contains("error")) fetchWeather(lastQuery);
});

/* ---------- Launch ---------- */
renderChips();
fetchWeather(lastQuery); // 1. Mumbai weather loads automatically on launch
