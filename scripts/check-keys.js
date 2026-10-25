// Checks the API keys in .env with one small request per source. Never prints the keys.
// Run: npm run check-keys
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES } from "../lib/sources.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");
if (!existsSync(envFile)) {
  console.log("No .env file. Copy .env.example to .env first.");
  process.exit(1);
}
for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const ctx = { keywords: "marketing", location: { name: "Paris", lat: 48.8566, lon: 2.3522, country: "FR" }, radius: 30 };
let failed = false;
for (const s of SOURCES.filter((x) => x.needsKey)) {
  if (!s.enabled()) { console.log(`-  ${s.label}: no key in .env (skipped)`); continue; }
  try {
    const jobs = await s.fetch(ctx);
    console.log(`OK ${s.label}: ${jobs.length} offers for "marketing" around Paris`);
  } catch (err) {
    failed = true;
    const msg = String(err.message || err).replace(/[A-Za-z0-9_-]{24,}/g, "***");
    console.log(`X  ${s.label}: ${msg}`);
  }
}
process.exit(failed ? 1 : 0);
