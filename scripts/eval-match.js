// Measures ranking quality on live offers: for several roles, how many of the top 10
// have a title that really belongs to the searched job family.
// Needs the server running (node server.js). Run: npm run eval
import { prepareJobs, scoreJobs, remoteEligible, distanceKm } from "../public/js/match.js";
import { normalize } from "../public/js/skills.js";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PARIS = { name: "Paris", lat: 48.8566, lon: 2.3522, country: "FR" };

// A title "fits" when it contains one of these words (judge only, not used by the app).
const CASES = [
  { role: "Marketing intern", fits: /marketing|brand|growth|social media|content|communication|community|seo|crm|e-?mail|acquisition|campaign/,
    cv: "Marketing student. Marketing intern: social media campaigns Instagram TikTok, Google Analytics, SEO, content creation, Canva, Excel, PowerPoint. Sales assistant part-time, customer service. English, French, Spanish. Teamwork, creativity." },
  { role: "Data analyst", fits: /data|analyst|analytics|bi\b|business intelligence|insight|reporting|statistic/,
    cv: "Data analyst intern 2023-2024. Python pandas, SQL, Power BI, Tableau, Excel, statistics, machine learning basics, dashboards, reporting. English, French." },
  { role: "Software developer", fits: /develop|engineer|software|backend|frontend|full ?stack|programm|devops|web/,
    cv: "Software developer 2021-2024. JavaScript, TypeScript, React, Node.js, Python, SQL, Docker, AWS, Git, REST APIs. Agile Scrum. English." },
  { role: "Sales", fits: /sales|account|business develop|vertrieb|commercial|vente|customer success|partnership|kam/,
    cv: "Business developer 2022-2024. B2B sales, prospecting, negotiation, CRM Salesforce HubSpot, key account management, customer success. English, French, German." },
  { role: "Finance analyst", fits: /financ|controll|accountant|accounting|comptab|fp&a|audit|treasury|invest|tax|buchhalt|m&a/,
    cv: "Finance intern 2023-2024. Financial modeling, valuation DCF, budgeting and forecasting, Excel VBA, PowerPoint, IFRS, accounting, audit. English, French." },
];

// REALISTIC=1: role guessed from the CV headline (what the app pre-fills) and a 50 km radius around Paris.
const REALISTIC = process.env.REALISTIC === "1";
const HEADLINES = {
  "Marketing intern": "Camille Martin\nMarketing & Business student — BBA\n",
  "Data analyst": "Lucas Bernard\nMSc Data Science student | Business School\n",
  "Software developer": "Ines Petit\nComputer science engineer — full stack developer\n",
  "Sales": "Hugo Moreau\nBusiness student — Sales & Business Development\n",
  "Finance analyst": "Lea Dubois\nMaster in Finance student — Corporate Finance\n",
};

async function run() {
  const { parseCv } = await import("../public/js/cv.js");
  let total = 0;
  for (const c of CASES) {
    const cvText = (REALISTIC ? HEADLINES[c.role] : "") + c.cv;
    const parsed = parseCv(cvText);
    const role = REALISTIC ? parsed.role || c.role : c.role;
    const { cleanRole } = await import("../public/js/roles.js");
    const first = role.split(/[,/]/)[0].trim();
    const keywords = cleanRole(first) || first;
    const r = await fetch(`${BASE}/api/search`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, location: PARIS, radius: REALISTIC ? 50 : 200 }),
    });
    const { jobs } = await r.json();
    const profile = { text: cvText, skills: parsed.skills, years: 1.5, role };
    const ranked = scoreJobs(prepareJobs(jobs), profile)
      .map((j) => ({ ...j, distance: distanceKm(PARIS, j) }))
      .filter((j) => !j.remote || remoteEligible(j, PARIS))
      .filter((j) => j.roleFit >= 0.4) // "Only offers matching my role" (on by default in the app)
      .filter((j) => !REALISTIC || j.remote || (j.distance != null && j.distance <= 50))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    if (REALISTIC) console.log(`\n(role pre-filled from CV: "${role}")`);
    const good = ranked.filter((j) => c.fits.test(normalize(j.title))).length;
    total += good;
    console.log(`\n== ${c.role}: ${good}/10 relevant (from ${jobs.length} offers)`);
    for (const j of ranked) console.log(`  ${c.fits.test(normalize(j.title)) ? "+" : "-"} ${String(j.score).padStart(3)}  ${j.title.slice(0, 80)}  [${j.sourceLabel}]`);
  }
  console.log(`\nTOTAL: ${total}/${CASES.length * 10} relevant in top 10`);
}
run().catch((e) => { console.error("Is the server running? ", e.message); process.exit(1); });
