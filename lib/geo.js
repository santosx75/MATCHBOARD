// Geocoding with Open-Meteo (free, no key). Results are cached for the life of the process.
const placeCache = new Map();
const MAX_LOOKUPS_PER_SEARCH = 60;

export async function geocodeCity(q) {
  const key = q.toLowerCase();
  if (placeCache.has(key)) return placeCache.get(key);
  let place = null;
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`);
    if (res.ok) {
      const r = (await res.json()).results?.[0];
      if (r) place = { name: r.name, lat: r.latitude, lon: r.longitude, country: r.country_code || "", region: r.admin1 || "" };
    }
  } catch { /* network issue: leave as unknown */ }
  placeCache.set(key, place);
  return place;
}

// Turns "75 - Paris 8e Arrondissement" or "Munich, Bavaria" into a city name we can geocode.
export function cleanLocation(raw) {
  if (!raw) return "";
  let s = String(raw).split(/[,(/|]/)[0];
  s = s.replace(/^\s*\d{1,3}\s*-\s*/, "")
    .replace(/\b\d+(e|er|ème)?\s*arrondissement\b/i, "")
    .replace(/\b\d{4,5}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(remote|worldwide|anywhere|global|europe|emea|hybrid|télétravail|home office)$/i.test(s)) return "";
  return s;
}

// Fills lat/lon on jobs that have a city but no coordinates. Remote-only jobs are skipped.
export async function geocodeJobs(jobs) {
  const todo = new Map();
  for (const j of jobs) {
    if (j.lat != null || ["remotive", "himalayas"].includes(j.source)) continue;
    const name = cleanLocation(j.location);
    if (!name) continue;
    if (!todo.has(name)) todo.set(name, []);
    todo.get(name).push(j);
  }
  const names = [...todo.keys()].slice(0, MAX_LOOKUPS_PER_SEARCH);
  const queue = [...names];
  const worker = async () => {
    while (queue.length) {
      const name = queue.shift();
      const place = await geocodeCity(name);
      if (!place) continue;
      for (const j of todo.get(name)) {
        j.lat = place.lat;
        j.lon = place.lon;
        if (!j.country) j.country = place.country;
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}
