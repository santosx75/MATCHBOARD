// Matchboard server: serves the web app and aggregates job offers from several job boards.
// No dependencies. Requires Node 18+ (built-in fetch). Run: node server.js
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES } from "./lib/sources.js";
import { geocodeJobs, geocodeCity } from "./lib/geo.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");

loadEnv(path.join(ROOT, ".env"));
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

// Small in-memory cache so we stay polite with the free APIs.
const cache = new Map();
const CACHE_MS = 20 * 60 * 1000;
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return v;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/api/sources" && req.method === "GET") {
      return json(res, 200, { sources: SOURCES.map((s) => ({ id: s.id, label: s.label, enabled: s.enabled(), needsKey: !!s.needsKey, remoteOnly: !!s.remoteOnly })) });
    }
    if (url.pathname === "/api/geocode" && req.method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
      if (!q) return json(res, 400, { error: "Missing q" });
      const place = await geocodeCity(q);
      return place ? json(res, 200, place) : json(res, 404, { error: "Place not found" });
    }
    if (url.pathname === "/api/search" && req.method === "POST") {
      const body = await readBody(req);
      return json(res, 200, await search(body));
    }
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(url.pathname, res);
    json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    json(res, 500, { error: "Server error" });
  }
});

async function search(body) {
  const keywords = String(body.keywords || "").trim().slice(0, 120);
  const location = body.location && typeof body.location === "object" ? {
    name: String(body.location.name || "").slice(0, 100),
    lat: Number(body.location.lat),
    lon: Number(body.location.lon),
    country: String(body.location.country || "").slice(0, 2).toUpperCase(),
  } : null;
  const radius = clamp(Number(body.radius) || 50, 1, 200);
  const ctx = { keywords, location, radius };

  const active = SOURCES.filter((s) => s.enabled());
  const results = await Promise.allSettled(active.map((s) =>
    cached(`${s.id}|${keywords}|${location?.name}|${s.usesRadius ? radius : ""}`, () => withTimeout(s.fetch(ctx), 15000))
  ));

  const status = [];
  let jobs = [];
  results.forEach((r, i) => {
    const s = active[i];
    if (r.status === "fulfilled") {
      jobs.push(...r.value);
      status.push({ id: s.id, label: s.label, ok: true, count: r.value.length });
    } else {
      console.warn(`[${s.id}]`, r.reason?.message || r.reason);
      status.push({ id: s.id, label: s.label, ok: false, count: 0, error: "Unavailable right now" });
    }
  });

  jobs = dedupe(jobs);
  await geocodeJobs(jobs);
  return { jobs, status, fetchedAt: new Date().toISOString() };
}

function dedupe(jobs) {
  const seen = new Set();
  return jobs.filter((j) => {
    const k = `${j.title}|${j.company}`.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function serveStatic(pathname, res) {
  const rel = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const file = path.normalize(path.join(PUBLIC, rel));
  const rel2 = path.relative(PUBLIC, file);
  if (rel2.startsWith("..") || path.isAbsolute(rel2)) return json(res, 403, { error: "Forbidden" });
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error("not a file");
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(data);
  } catch {
    json(res, 404, { error: "Not found" });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 100_000) { reject(new Error("Body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

function json(res, code, data) {
  res.writeHead(code, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

server.listen(PORT, () => {
  const on = SOURCES.filter((s) => s.enabled()).map((s) => s.label).join(", ");
  console.log(`Matchboard running on http://localhost:${PORT}`);
  console.log(`Live sources: ${on}`);
});
