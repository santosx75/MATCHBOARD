import { normalize } from "./skills.js";

// Contract types people search for most (France + Europe). Each offer can have several.
// `title` patterns are checked on the job title + source fields; `body` on the description.
export const CONTRACTS = [
  { id: "cdi", label: "Permanent", sub: "CDI",
    title: /\bcdi\b|\bpermanent\b|full[_ ]time permanent|festanstellung|unbefristet/,
    body: /\bcdi\b|contrat a duree indeterminee|permanent (contract|position|role)|unbefristet/ },
  { id: "cdd", label: "Fixed-term", sub: "CDD",
    title: /\bcdd\b|fixed[- ]term|\bcontract\b|befristet/,
    body: /\bcdd\b|contrat a duree determinee|fixed[- ]term|befristet|\d+[- ]months? contract/ },
  { id: "internship", label: "Internship", sub: "Stage",
    title: /\binternship\b|\bintern\b|(?<![a-z-])stage(?![a-z-])|\bstagiaire\b|praktikum|praktikant/,
    body: /\binternship\b|\bstagiaire\b|convention de stage|stage de fin d'etudes|\bstage de \d|offre de stage|pflichtpraktikum/ },
  { id: "apprenticeship", label: "Apprenticeship", sub: "Alternance",
    title: /alternance|alternant|apprenti|apprenticeship|work[- ]study|contrat pro|ausbildung|duales studium/,
    body: /alternance|\bapprenti|contrat d'apprentissage|contrat de professionnalisation|work[- ]study|apprenticeship|duales studium/ },
  { id: "interim", label: "Temp / Agency", sub: "Intérim",
    title: /interim|\btemp\b|temporary|zeitarbeit|\bmis\b|travail temporaire/,
    body: /\binterim\b|mission d'interim|travail temporaire|temporary (role|position|assignment)|zeitarbeit|leiharbeit/ },
  { id: "freelance", label: "Freelance", sub: "Indépendant",
    title: /freelance|free-lance|contractor|independant|\blib\b|self[- ]employed|freiberuf/,
    body: /freelance|auto[- ]entrepreneur|independent contractor|self[- ]employed|portage salarial|freiberuf/ },
  { id: "parttime", label: "Part-time", sub: "Temps partiel",
    title: /part[_ -]?time|temps partiel|teilzeit|minijob/,
    body: /part[- ]time|temps partiel|teilzeit|minijob|\b(1\d|2\d)\s?h(eures)?\s?(\/|par)\s?semaine/ },
  { id: "extras", label: "Extras / Gigs", sub: "Extras",
    title: /\bextras?\b|vacataire|renfort|event staff|\bgig\b|\bshifts?\b|mission ponctuelle/,
    body: /\ben extras?\b|\bextras? (en|pour|restauration|hotellerie|evenementiel)|vacataire|staff evenementiel|event staff|renforts? (ponctuels?|week-?end)|missions? ponctuelles?|\bgig\b|shift work|flexible shifts/ },
  { id: "seasonal", label: "Seasonal / Summer", sub: "Saisonnier",
    title: /saisonnier|saisonniere|seasonal|job d'ete|summer job|summer|\bsai\b|ferienjob|saison/,
    body: /saisonnier|emploi saisonnier|job d'ete|summer job|seasonal (job|work|position)|ferienjob|pour la saison/ },
  { id: "student", label: "Student job", sub: "Job étudiant",
    title: /student|etudiant|werkstudent|campus/,
    body: /job etudiant|jobs etudiants|ideal (pour )?etudiant|compatible avec (vos|tes) etudes|werkstudent|student job|student assistant/ },
  { id: "vie", label: "VIE", sub: "International",
    title: /\bv\.?i\.?e\b|volontariat international/,
    body: /\bv\.i\.e\b|volontariat international en entreprise|\bvie contract\b/ },
  { id: "volunteer", label: "Volunteer", sub: "Service civique",
    title: /volunteer|benevol|service civique|ehrenamt/,
    body: /volunteer (role|position)|benevolat|service civique|ehrenamt/ },
];

export const OTHER = { id: "other", label: "Other", sub: "Not specified" };
export const CONTRACT_BY_ID = new Map([...CONTRACTS, OTHER].map((c) => [c.id, c]));

// Source-specific codes (France Travail typeContrat, Adzuna, Remotive, Himalayas fields).
const HINT_MAP = {
  cdi: "cdi", permanent: "cdi", "full time": null, full_time: null,
  cdd: "cdd", contract: "cdd",
  mis: "interim", temporary: "interim",
  sai: "seasonal",
  lib: "freelance", freelance: "freelance", contractor: "freelance",
  part_time: "parttime", "part time": "parttime", "temps partiel": "parttime",
  internship: "internship", intern: "internship",
  alternance: "apprenticeship",
};

export function classifyContracts(job) {
  // On remote boards (Remotive, Himalayas) "contract" means contractor work, not a French CDD.
  const remoteBoard = job.source === "remotive" || job.source === "himalayas";
  const hints = (job.contractHints || []).map((h) => {
    const n = normalize(h).trim();
    return remoteBoard && n === "contract" ? "freelance" : n;
  });
  const head = normalize(`${job.title} ${hints.join(" ")}`);
  const body = normalize(job.description).slice(0, 4000);
  const out = new Set();
  for (const h of hints) {
    const id = HINT_MAP[h];
    if (id) out.add(id);
  }
  const fromTitle = new Set();
  for (const c of CONTRACTS) {
    if (c.title.test(head)) { out.add(c.id); fromTitle.add(c.id); }
  }
  // When the title already says "internship", "alternance", "extra"..., a CDI/CDD mentioned in the
  // description is usually a future opportunity ("possible CDI after"), not the contract itself.
  const titleIsShort = ["internship", "apprenticeship", "extras", "seasonal", "student", "vie", "freelance", "interim"].some((id) => fromTitle.has(id));
  for (const c of CONTRACTS) {
    if (fromTitle.has(c.id) || !c.body.test(body)) continue;
    if (titleIsShort && (c.id === "cdi" || c.id === "cdd")) continue;
    out.add(c.id);
  }
  // "Contract" in a title of a freelance board means freelance, not CDD.
  if (out.has("freelance") && out.has("cdd") && !/\bcdd\b|fixed/.test(head + body)) out.delete("cdd");
  if (!out.size) out.add("other");
  return [...out];
}
