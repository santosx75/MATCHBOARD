// Job board connectors. Each returns jobs in one shared shape:
// { id, source, sourceLabel, title, company, location, country, lat, lon, remote,
//   url, description, postedAt, salary, contractHints[], skillsHint[] }
//
// Free, no key: Arbeitnow, Remotive, Himalayas.
// Free key needed (set in .env): Adzuna (aggregates Indeed-like listings), France Travail, Jooble.
// LinkedIn, Indeed, Welcome to the Jungle, etc. have no public API: the app links to them instead.

const UA = { "User-Agent": "Matchboard/1.0 (student job matching app)", Accept: "application/json" };
const MAX_DESC = 8000;

export const SOURCES = [
  {
    id: "francetravail",
    label: "France Travail",
    needsKey: true,
    usesRadius: true,
    enabled: () => !!(process.env.FRANCE_TRAVAIL_CLIENT_ID && process.env.FRANCE_TRAVAIL_CLIENT_SECRET),
    fetch: fetchFranceTravail,
  },
  {
    id: "adzuna",
    label: "Adzuna",
    needsKey: true,
    usesRadius: true,
    enabled: () => !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    fetch: fetchAdzuna,
  },
  {
    id: "jooble",
    label: "Jooble",
    needsKey: true,
    usesRadius: true,
    enabled: () => !!process.env.JOOBLE_API_KEY,
    fetch: fetchJooble,
  },
  { id: "arbeitnow", label: "Arbeitnow", enabled: () => true, fetch: fetchArbeitnow },
  { id: "remotive", label: "Remotive", remoteOnly: true, enabled: () => true, fetch: fetchRemotive },
  { id: "himalayas", label: "Himalayas", remoteOnly: true, enabled: () => true, fetch: fetchHimalayas },
];

/* ---------- Free sources ---------- */

async function fetchArbeitnow({ keywords }) {
  const q = encodeURIComponent(keywords);
  const pages = await Promise.all([1, 2].map((p) =>
    getJSON(`https://www.arbeitnow.com/api/job-board-api?search=${q}&page=${p}`).catch(() => ({ data: [] }))
  ));
  const jobs = pages.flatMap((p) => p.data || []).map((j) => ({
    id: `arbeitnow:${j.slug}`,
    source: "arbeitnow",
    sourceLabel: "Arbeitnow",
    title: j.title,
    company: j.company_name,
    location: j.location || "",
    country: "",
    lat: null, lon: null,
    remote: !!j.remote,
    url: j.url,
    description: htmlToText(j.description),
    postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
    salary: null,
    contractHints: [...(j.job_types || [])],
    skillsHint: j.tags || [],
  }));
  return keepRelevant(jobs, keywords);
}

async function fetchRemotive({ keywords }) {
  const data = await getJSON(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keywords)}&limit=60`);
  return (data.jobs || []).map((j) => ({
    id: `remotive:${j.id}`,
    source: "remotive",
    sourceLabel: "Remotive",
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || "Remote",
    country: "",
    lat: null, lon: null,
    remote: true,
    url: j.url,
    description: htmlToText(j.description),
    postedAt: j.publication_date ? new Date(j.publication_date + "Z").toISOString() : null,
    salary: j.salary || null,
    contractHints: [j.job_type].filter(Boolean),
    skillsHint: j.tags || [],
  }));
}

async function fetchHimalayas({ keywords }) {
  const q = encodeURIComponent(keywords);
  const pages = await Promise.all([1, 2].map((p) =>
    getJSON(`https://himalayas.app/jobs/api/search?q=${q}&page=${p}`).catch(() => ({ jobs: [] }))
  ));
  return pages.flatMap((p) => p.jobs || []).map((j) => ({
    id: `himalayas:${j.guid || j.applicationLink || j.title}`,
    source: "himalayas",
    sourceLabel: "Himalayas",
    title: j.title,
    company: j.companyName,
    location: (j.locationRestrictions || []).join(", ") || "Remote",
    country: "",
    lat: null, lon: null,
    remote: true,
    url: j.applicationLink || `https://himalayas.app/companies/${j.companySlug}/jobs`,
    description: htmlToText(j.description || j.excerpt),
    postedAt: toIso(j.pubDate),
    salary: j.minSalary ? `${j.minSalary}${j.maxSalary ? "–" + j.maxSalary : ""} ${j.currency || ""}`.trim() : null,
    contractHints: [j.employmentType, ...(j.seniority || [])].filter(Boolean),
    skillsHint: j.categories || [],
  }));
}

/* ---------- Key-based sources ---------- */

async function fetchAdzuna({ keywords, location, radius }) {
  const country = (process.env.ADZUNA_COUNTRY || location?.country || "fr").toLowerCase();
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID,
    app_key: process.env.ADZUNA_APP_KEY,
    results_per_page: "50",
    what: keywords,
    "content-type": "application/json",
  });
  if (location?.name) { params.set("where", location.name); params.set("distance", String(radius)); }
  const pages = await Promise.all([1, 2].map((p) =>
    getJSON(`https://api.adzuna.com/v1/api/jobs/${country}/search/${p}?${params}`).catch(() => ({ results: [] }))
  ));
  return pages.flatMap((p) => p.results || []).map((j) => ({
    id: `adzuna:${j.id}`,
    source: "adzuna",
    sourceLabel: "Adzuna",
    title: htmlToText(j.title),
    company: j.company?.display_name || "",
    location: j.location?.display_name || "",
    country: country.toUpperCase(),
    lat: num(j.latitude), lon: num(j.longitude),
    remote: /remote|télétravail|teletravail/i.test(j.title + " " + j.description),
    url: j.redirect_url,
    description: htmlToText(j.description),
    postedAt: j.created || null,
    salary: j.salary_min ? `${Math.round(j.salary_min)}${j.salary_max && j.salary_max !== j.salary_min ? "–" + Math.round(j.salary_max) : ""} €` : null,
    contractHints: [j.contract_type, j.contract_time].filter(Boolean),
    skillsHint: j.category?.label ? [j.category.label] : [],
  }));
}

let ftToken = null;
async function franceTravailToken() {
  if (ftToken && Date.now() < ftToken.exp) return ftToken.value;
  const res = await fetch("https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.FRANCE_TRAVAIL_CLIENT_ID,
      client_secret: process.env.FRANCE_TRAVAIL_CLIENT_SECRET,
      scope: "api_offresdemploiv2 o2dsoffre",
    }),
  });
  if (!res.ok) throw new Error(`France Travail auth ${res.status}`);
  const t = await res.json();
  ftToken = { value: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000 };
  return ftToken.value;
}

async function fetchFranceTravail({ keywords, location, radius }) {
  const token = await franceTravailToken();
  const params = new URLSearchParams({ motsCles: keywords.slice(0, 60), range: "0-149" });
  if (location && Number.isFinite(location.lat) && (location.country === "FR" || !location.country)) {
    const communes = await getJSON(`https://geo.api.gouv.fr/communes?lat=${location.lat}&lon=${location.lon}&fields=code`).catch(() => []);
    if (communes[0]?.code) {
      params.set("commune", communes[0].code);
      params.set("distance", String(Math.min(radius, 200)));
    }
  }
  const res = await fetch(`https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`France Travail ${res.status}`);
  const data = await res.json();
  return (data.resultats || []).map((j) => ({
    id: `francetravail:${j.id}`,
    source: "francetravail",
    sourceLabel: "France Travail",
    title: j.intitule,
    company: j.entreprise?.nom || "",
    location: j.lieuTravail?.libelle || "",
    country: "FR",
    lat: num(j.lieuTravail?.latitude), lon: num(j.lieuTravail?.longitude),
    remote: /télétravail|teletravail|remote/i.test(j.description || ""),
    url: j.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${j.id}`,
    description: (j.description || "").slice(0, MAX_DESC),
    postedAt: j.dateCreation || null,
    salary: j.salaire?.libelle || null,
    contractHints: [j.typeContrat, j.typeContratLibelle, j.natureContrat, j.dureeTravailLibelleConverti, j.alternance ? "alternance" : ""].filter(Boolean),
    skillsHint: (j.competences || []).map((c) => c.libelle),
  }));
}

async function fetchJooble({ keywords, location, radius }) {
  const res = await fetch(`https://jooble.org/api/${process.env.JOOBLE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords, location: location?.name || "", radius: String(radius), page: "1" }),
  });
  if (!res.ok) throw new Error(`Jooble ${res.status}`);
  const data = await res.json();
  return (data.jobs || []).map((j) => ({
    id: `jooble:${j.id}`,
    source: "jooble",
    sourceLabel: "Jooble",
    title: htmlToText(j.title),
    company: j.company || "",
    location: j.location || "",
    country: "",
    lat: null, lon: null,
    remote: /remote|télétravail/i.test(j.title + " " + j.snippet),
    url: j.link,
    description: htmlToText(j.snippet),
    postedAt: j.updated || null,
    salary: j.salary || null,
    contractHints: [j.type].filter(Boolean),
    skillsHint: [],
  }));
}

/* ---------- Helpers ---------- */

async function getJSON(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

// Accepts Unix seconds, Unix milliseconds or a date string.
function toIso(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Keeps the jobs that mention at least one search word, best first (for boards that ignore ?search=).
function keepRelevant(jobs, keywords, max = 150) {
  const words = keywords.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9+#]+/).filter((w) => w.length > 2);
  if (!words.length) return jobs.slice(0, max);
  const hits = (j) => {
    const title = j.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const body = (j.skillsHint.join(" ") + " " + j.description.slice(0, 3000)).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return words.reduce((s, w) => s + (title.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0), 0);
  };
  return jobs.map((j) => [hits(j), j]).filter(([h]) => h > 0).sort((a, b) => b[0] - a[0]).slice(0, max).map(([, j]) => j);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "–", mdash: "—", hellip: "…", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç" };
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function htmlToText(html) {
  if (!html) return "";
  let s = String(html);
  if (/&lt;\w/.test(s)) s = decode(s); // some feeds double-encode their HTML
  s = s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d|\/tr)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ");
  s = decode(s).replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return s.slice(0, MAX_DESC);
}
