// Job families: used to (1) suggest a target role from the CV, (2) judge whether an offer's
// title belongs to the role the user wants. Keywords are lower-case, accent-free, EN / FR / DE.
import { normalize } from "./skills.js";

export const FAMILIES = [
  { id: "marketing", title: "Marketing",
    words: ["marketing", "brand", "growth", "social media", "community manager", "community management", "content", "communication", "seo", "sea", "crm", "e-mail", "email", "acquisition", "campaign", "influence", "relations presse", "public relations", "digital", "chef de produit", "product marketing", "evenementiel", "event"],
    skills: ["Digital marketing", "Marketing", "SEO", "SEA / Paid ads", "Social media", "Content marketing", "Brand management", "Email marketing", "Google Analytics", "Communication", "Event management", "E-commerce"] },
  { id: "data", title: "Data analyst",
    words: ["data", "analyst", "analytics", "analyste", "business intelligence", "bi", "insight", "reporting", "statisti", "machine learning", "scientist", "quantitative"],
    skills: ["SQL", "Python", "Power BI", "Tableau", "Looker", "Data analysis", "Statistics", "Machine learning", "Data visualization", "R", "Deep learning", "AI / LLM"] },
  { id: "software", title: "Software developer",
    words: ["developer", "developpeur", "developpeuse", "engineer", "ingenieur", "software", "backend", "back-end", "frontend", "front-end", "full stack", "fullstack", "full-stack", "devops", "web", "mobile", "entwickler", "programm", "sre", "qa", "tech lead", "architect"],
    skills: ["JavaScript", "TypeScript", "React", "Vue", "Angular", "Node.js", "HTML / CSS", "Java", "C#", "C / C++", "PHP", "Go", "Ruby", "Swift / iOS", "Kotlin / Android", "Cloud (AWS / Azure / GCP)", "DevOps", "Git", "Linux", "APIs"] },
  { id: "sales", title: "Sales / Business developer",
    words: ["sales", "account executive", "account manager", "business develop", "business developer", "commercial", "commerciale", "sdr", "bdr", "key account", "customer success", "partnership", "vertrieb", "inside sales", "ingenieur d'affaires", "charge d'affaires", "conseiller commercial"],
    skills: ["Sales", "Negotiation", "CRM", "Salesforce", "HubSpot", "Key account management", "Business development", "Customer service"] },
  { id: "finance", title: "Finance analyst",
    words: ["finance", "financial", "financier", "financiere", "controller", "controle de gestion", "controleur", "controlling", "accountant", "comptable", "accounting", "comptabilite", "audit", "auditor", "auditeur", "fp&a", "treasury", "tresorerie", "investment", "investissement", "m&a", "corporate finance", "private equity", "valuation", "credit", "tax", "fiscal", "buchhalt", "banque", "bank", "asset management"],
    skills: ["Financial modeling", "Financial analysis", "Accounting", "Audit", "Corporate finance", "M&A", "Valuation", "Budgeting & forecasting", "Private equity", "Asset management", "IFRS", "Bloomberg", "Treasury", "Tax", "Risk management"] },
  { id: "consulting", title: "Consultant",
    words: ["consultant", "consulting", "conseil", "strategy", "strategie", "strategic", "business analyst", "transformation", "advisory"],
    skills: ["Consulting", "Strategy", "Business analysis", "Market research"] },
  { id: "project", title: "Project / Product manager",
    words: ["project manager", "chef de projet", "cheffe de projet", "product manager", "product owner", "pmo", "scrum master", "program manager", "projektmanager", "chargee de projet", "charge de projet"],
    skills: ["Project management", "Product management", "Agile / Scrum", "Jira"] },
  { id: "hr", title: "HR / Recruiter",
    words: ["hr", "rh", "human resources", "ressources humaines", "recruit", "recrut", "talent", "payroll", "paie", "people", "personal"],
    skills: ["Human resources", "Recruitment", "Payroll"] },
  { id: "supply", title: "Supply chain / Purchasing",
    words: ["supply chain", "logisti", "procurement", "purchasing", "achat", "acheteur", "acheteuse", "buyer", "approvisionnement", "planner", "operations", "einkauf"],
    skills: ["Supply chain", "Procurement", "Operations management", "Lean / Six Sigma", "SAP"] },
  { id: "design", title: "Designer",
    words: ["design", "designer", "ux", "ui", "graphi", "creative", "creatif", "motion", "video", "directeur artistique", "art director"],
    skills: ["UX / UI design", "Figma", "Adobe Creative Suite", "Canva", "Video editing"] },
  { id: "legal", title: "Legal",
    words: ["legal", "juriste", "lawyer", "avocat", "compliance", "paralegal", "juridique", "jurist"],
    skills: ["Legal", "GDPR"] },
  { id: "hospitality", title: "Waiter / Barista",
    words: ["waiter", "waitress", "serveur", "serveuse", "barista", "bartender", "barman", "barmaid", "runner", "cuisinier", "cook", "chef de rang", "commis", "hote", "hotesse", "host", "hostess", "reception", "receptionist", "accueil", "housekeeping", "restauration", "restaurant", "hotel", "kellner", "plonge", "employe polyvalent", "equipier"],
    skills: ["Hospitality", "Food & beverage service", "Cooking", "Reception"] },
  { id: "retail", title: "Sales associate (retail)",
    words: ["vendeur", "vendeuse", "sales associate", "sales advisor", "conseiller de vente", "conseillere de vente", "caissier", "caissiere", "cashier", "retail", "store", "magasin", "boutique", "merchandis", "employe libre service", "verkaufer"],
    skills: ["Retail", "Cashier", "Stock & inventory"] },
  { id: "education", title: "Tutor / Childcare",
    words: ["tutor", "teacher", "professeur", "enseignant", "soutien scolaire", "cours particuliers", "baby-sit", "babysit", "nanny", "garde d'enfants", "animateur", "animatrice", "educat"],
    skills: ["Tutoring / teaching", "Childcare"] },
  { id: "logistics", title: "Warehouse / Delivery",
    words: ["driver", "chauffeur", "livreur", "livreuse", "delivery", "warehouse", "entrepot", "preparateur", "preparatrice", "magasinier", "cariste", "manutention", "lager"],
    skills: ["Delivery / driving", "Stock & inventory"] },
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const f of FAMILIES) {
  // Whole-word match at the start; word stems like "statisti" or "recrut" may continue.
  f.re = new RegExp(`(?<![a-z0-9])(${f.words.map(escape).join("|")})`, "");
}

// Families whose keywords appear in a text (a role, a title).
export function familiesIn(text) {
  const t = normalize(text);
  return FAMILIES.filter((f) => f.re.test(t));
}

// Words that describe the person or the contract, not the job itself.
const NOISE = /\b(student|students|etudiant|etudiante|eleve|msc|mba|bba|bsc|ba|ma|master|masters|bachelor|licence|degree|diplome|graduate|school|business school|ecole|university|universite|year|annee|in|of|en|de|du|des|la|le|and|et|program|programme|grande ecole|candidate|seeking|looking for|recherche|alternance|stage|internship|intern|apprenticeship|cdi|cdd|junior|senior|h\/f|f\/h|m\/w\/d)\b/g;

// "Master in Finance student — Corporate Finance" -> "Finance Corporate Finance" -> family-based suggestion.
export function cleanRole(text) {
  return normalize(text).replace(/[—–|•·,;:()/]/g, " ").replace(NOISE, " ").replace(/\s+/g, " ").trim();
}

// Up to 3 role suggestions from the CV: headline words count most, then the skills found.
export function suggestRoles(cvText, skills) {
  const head = normalize(String(cvText || "").split(/\n/).slice(0, 6).join(" "));
  const have = new Set(skills);
  const scored = FAMILIES.map((f) => {
    const skillHits = f.skills.filter((s) => have.has(s)).length;
    const headHit = f.re.test(head) ? 4 : 0;
    return { family: f, score: headHit + skillHits };
  }).filter((x) => x.score >= 2).sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((x) => x.family.title);
}

// Job-level words shared by every field: "Finance analyst" must not match "Data analyst"
// just because both say "analyst". They count for a third of a field word.
const GENERIC = new Set(["analyst", "analyste", "manager", "engineer", "ingenieur", "consultant", "assistant", "assistante", "officer", "associate", "specialist", "specialiste", "charge", "chargee", "lead", "head", "director", "directeur", "responsable", "coordinator", "coordinateur", "executive", "advisor", "conseiller", "team", "member"]);

// Families named by the role's field words ("finance analyst" -> finance only, not data).
function roleFamilies(roleClean) {
  const specific = roleClean.split(" ").filter((w) => !GENERIC.has(w)).join(" ");
  return familiesIn(specific || roleClean);
}

// How well an offer title fits the target role: 1 = same words, 0.8 = same job family, 0 = unrelated.
export function titleRelevance(title, role) {
  const roleClean = cleanRole(role);
  if (!roleClean) return 1; // no role given: don't judge titles
  const t = normalize(title);
  const words = roleClean.split(" ").filter((w) => w.length > 2 || ["hr", "rh", "ux", "ui", "bi", "qa"].includes(w));
  let need = 0, hit = 0;
  for (const w of words) {
    const weight = GENERIC.has(w) ? 1 / 3 : 1;
    need += weight;
    if (new RegExp(`(?<![a-z0-9])${escape(w)}`).test(t)) hit += weight;
  }
  const tokenHit = need ? hit / need : 0;
  const fams = roleFamilies(roleClean);
  const famHit = fams.some((f) => f.re.test(t)) ? 0.8 : 0;
  if (!fams.length && !words.length) return 1;
  return Math.max(tokenHit, famHit);
}
