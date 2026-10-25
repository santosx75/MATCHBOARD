import { extractSkills, normalize, skillByName } from "./skills.js";
import { classifyContracts } from "./contracts.js";

const STOP = new Set(`a an the and or of to in on for with at by from as is are be this that we you our your will can it its they their not but if into about over per via
le la les un une des du de d l et ou en au aux pour par sur dans avec sans ce cette ces vous nous notre votre vos nos est sont etre sera qui que quoi dont ou plus tres tout tous toute toutes son sa ses leur leurs
der die das und oder ein eine einen zu im in mit fur von auf ist sind wir sie ihr ihre bei als auch
job jobs offer offre poste position role team equipe company entreprise work travail experience years ans h f m w d hf fh mwd new`.split(/\s+/));

// Words that mean the same thing for matching (EN / FR / DE).
const SYNONYMS = {
  internship: "intern", stage: "intern", stagiaire: "intern", praktikum: "intern", praktikant: "intern", trainee: "intern",
  alternance: "apprentice", alternant: "apprentice", apprenti: "apprentice", apprenticeship: "apprentice", apprentissage: "apprentice", ausbildung: "apprentice",
  developpeur: "developer", entwickler: "developer", dev: "developer",
  analyste: "analyst", ingenieur: "engineer", commercial: "sales", vendeur: "sales", vendeuse: "sales", vente: "sales", vertrieb: "sales",
  chef: "manager", responsable: "manager", charge: "officer", chargee: "officer",
  serveur: "waiter", serveuse: "waiter", waitress: "waiter", kellner: "waiter",
  comptable: "accountant", comptabilite: "accounting", finances: "finance", financier: "finance", financial: "finance",
  marketeur: "marketing", communication: "communication", rh: "hr", recruteur: "recruiter",
};

export function tokenize(text) {
  return normalize(text)
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t))
    .map((t) => SYNONYMS[t] || (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t))
    .filter((t) => t.length > 2 || t === "hr");
}

function termFreq(tokens) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

function cosine(a, b, idf) {
  let dot = 0, na = 0, nb = 0;
  for (const [t, f] of a) {
    const w = f * (idf.get(t) || 1);
    na += w * w;
    const g = b.get(t);
    if (g) dot += w * g * (idf.get(t) || 1);
  }
  for (const [t, f] of b) {
    const w = f * (idf.get(t) || 1);
    nb += w * w;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// "3+ years of experience", "2 ans d'expérience", "mindestens 2 Jahre Berufserfahrung"
const REQ_YEARS = /(\d{1,2})\s*(?:\+|-\s*\d{1,2}|a\s*\d{1,2})?\s*(?:years?|yrs|ans|annees|jahre)\b[^.\n]{0,30}?(?:experience|exp\b|berufserfahrung|in a similar|dans un poste)/;
const SENIOR = /\b(senior|sr\.?|lead|principal|head of|director|directeur|directrice|vp|chief|manager confirme|expert)\b/;
const JUNIOR = /\b(junior|jr\.?|entry[- ]level|graduate|debutant|debutants acceptes|no experience|sans experience|premiere experience|stagiaire|intern|student|etudiant|alternance|apprenti)\b/;

export function requiredYears(job) {
  const t = normalize(`${job.title}\n${job.description}`);
  const m = t.match(REQ_YEARS);
  if (m) return Math.min(15, Number(m[1]));
  if (JUNIOR.test(normalize(job.title))) return 0;
  if (SENIOR.test(normalize(job.title))) return 5;
  return null;
}

// Prepare jobs once per search: skills, contracts, tokens, idf.
export function prepareJobs(rawJobs) {
  const jobs = rawJobs.map((j) => {
    const text = `${j.title}\n${(j.skillsHint || []).join(", ")}\n${j.description}`;
    const skills = extractSkills(text);
    for (const h of j.skillsHint || []) {
      const s = skillByName(h);
      if (s) skills.add(s.name);
    }
    return {
      ...j,
      skills,
      contracts: classifyContracts(j),
      reqYears: requiredYears(j),
      titleTokens: new Set(tokenize(j.title)),
      tf: termFreq(tokenize(text)),
    };
  });
  const df = new Map();
  for (const j of jobs) for (const t of j.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const n = jobs.length || 1;
  const idf = new Map([...df].map(([t, d]) => [t, Math.log(1 + n / d)]));
  return { jobs, idf };
}

// Scores every job against the profile. Returns a new array with `score` (0–100) and `breakdown`.
export function scoreJobs({ jobs, idf }, profile) {
  const cvSkills = new Set(profile.skills);
  const cvTf = termFreq(tokenize(`${profile.text || ""}\n${[...cvSkills].join(" ")}\n${profile.role || ""}`));
  const roles = String(profile.role || "")
    .split(/[,;/]| or | ou /i)
    .map((r) => tokenize(r))
    .filter((r) => r.length);
  const cvYears = Number(profile.years) || 0;

  return jobs.map((job) => {
    // 1. Skills: share of the job's skills the candidate has (weighted), plus a bonus for depth.
    let need = 0, have = 0;
    const matched = [], missing = [];
    for (const name of job.skills) {
      const w = skillByName(name)?.weight ?? 1;
      need += w;
      if (cvSkills.has(name)) { have += w; matched.push(name); } else missing.push(name);
    }
    const coverage = need ? have / need : 0;
    const depth = Math.min(1, matched.length / 5);
    const skillScore = need ? 0.7 * coverage + 0.3 * depth : null;

    // 2. Title: how well the job title matches the target role(s).
    let titleScore = 0;
    for (const r of roles) {
      const hit = r.filter((t) => job.titleTokens.has(t)).length / r.length;
      titleScore = Math.max(titleScore, hit);
    }
    if (!roles.length) {
      const cvTop = [...cvSkills].flatMap((s) => tokenize(s));
      titleScore = cvTop.some((t) => job.titleTokens.has(t)) ? 0.6 : 0;
    }

    // 3. Text similarity (TF-IDF cosine) between the CV and the full offer.
    const textScore = Math.min(1, cosine(cvTf, job.tf, idf) / 0.3);

    // 4. Experience fit.
    let expScore = 1;
    if (job.reqYears != null && job.reqYears > cvYears) {
      expScore = Math.max(0, 1 - (job.reqYears - cvYears) / Math.max(3, job.reqYears));
    }

    const parts = skillScore == null
      ? [[titleScore, 0.35], [textScore, 0.5], [expScore, 0.15]]
      : [[skillScore, 0.45], [titleScore, 0.25], [textScore, 0.18], [expScore, 0.12]];
    // A big experience gap also scales the whole score down, so senior roles sink for juniors.
    const total = parts.reduce((s, [v, w]) => s + v * w, 0) * (0.7 + 0.3 * expScore);

    return {
      ...job,
      score: Math.round(Math.min(1, total) * 100),
      breakdown: {
        skills: skillScore == null ? null : Math.round(skillScore * 100),
        title: Math.round(titleScore * 100),
        text: Math.round(textScore * 100),
        experience: Math.round(expScore * 100),
      },
      matched,
      missing: missing.sort((a, b) => (skillByName(b)?.weight ?? 1) - (skillByName(a)?.weight ?? 1)),
    };
  });
}

const EUROPE = new Set(["FR", "DE", "BE", "CH", "ES", "IT", "NL", "LU", "PT", "IE", "AT", "GB", "DK", "SE", "NO", "FI", "PL", "CZ", "GR", "RO", "HU"]);
const COUNTRY_WORDS = {
  FR: "france|french", DE: "germany|deutschland|german", BE: "belgium|belgique", CH: "switzerland|suisse|schweiz",
  ES: "spain|espagne", IT: "italy|italie", NL: "netherlands|pays-bas|holland", LU: "luxembourg", PT: "portugal",
  IE: "ireland", AT: "austria|osterreich", GB: "united kingdom|uk|england|britain", DK: "denmark", SE: "sweden",
  NO: "norway", FI: "finland", PL: "poland", CZ: "czech", GR: "greece", RO: "romania", HU: "hungary",
};

// Can someone living in `place` apply to this remote job? Uses the board's location restriction text.
export function remoteEligible(job, place) {
  if (!place?.country) return true;
  const loc = normalize(job.location || "");
  if (!loc || /worldwide|anywhere|global|remote$|^remote|international|all countries/.test(loc)) return true;
  const cc = place.country.toUpperCase();
  if (COUNTRY_WORDS[cc] && new RegExp(`\\b(${COUNTRY_WORDS[cc]})\\b`).test(loc)) return true;
  if (EUROPE.has(cc) && /\b(europe|emea|eu|eea|cet|cest)\b/.test(loc)) return true;
  // Arbeitnow/Adzuna/France Travail give the office city, not a restriction: keep them.
  return job.lat != null;
}

export function distanceKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
