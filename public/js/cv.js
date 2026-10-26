// Reads a CV file in the browser (PDF, DOCX, TXT) and extracts skills + years of experience.
// Nothing is uploaded: parsing happens on the user's device.
import { extractSkills, normalize } from "./skills.js";
import { suggestRoles, cleanRole, familiesIn } from "./roles.js";

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const MAMMOTH = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
const MAX_BYTES = 10 * 1024 * 1024;

const loaded = new Map();
function loadScript(src) {
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { loaded.delete(src); reject(new Error("Could not load the file reader. Check your connection.")); };
      document.head.appendChild(s);
    }));
  }
  return loaded.get(src);
}

export async function readCvFile(file) {
  if (file.size > MAX_BYTES) throw new Error("File is larger than 10 MB.");
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return readPdf(file);
  if (name.endsWith(".docx")) return readDocx(file);
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) return file.text();
  throw new Error("Unsupported file. Use PDF, DOCX or TXT.");
}

async function readPdf(file) {
  await loadScript(PDFJS);
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Rebuild lines from the y position of each text item.
    let lastY = null, line = "", lines = [];
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ""; }
      line += (line && !line.endsWith(" ") ? " " : "") + item.str;
      lastY = y;
    }
    lines.push(line);
    pages.push(lines.join("\n"));
  }
  const text = pages.join("\n\n").trim();
  if (text.length < 40) throw new Error("This PDF looks like a scan (no selectable text). Paste your CV text instead.");
  return text;
}

async function readDocx(file) {
  await loadScript(MAMMOTH);
  const { value } = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

/* ---------- Parsing ---------- */

const MONTHS = {
  jan: 0, janv: 0, january: 0, janvier: 0, januar: 0,
  feb: 1, fev: 1, february: 1, fevrier: 1, februar: 1,
  mar: 2, mars: 2, march: 2, marz: 2,
  apr: 3, avr: 3, april: 3, avril: 3,
  may: 4, mai: 4,
  jun: 5, juin: 5, june: 5, juni: 5,
  jul: 6, juil: 6, july: 6, juillet: 6, juli: 6,
  aug: 7, aou: 7, aout: 7, august: 7,
  sep: 8, sept: 8, september: 8, septembre: 8,
  oct: 9, october: 9, octobre: 9, oktober: 9,
  nov: 10, november: 10, novembre: 10,
  dec: 11, december: 11, decembre: 11, dezember: 11,
};
const MONTH_RE = "(?:" + Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|") + ")\\.?";
const NOW_RE = "present|current|now|today|ongoing|aujourd'hui|actuel|actuellement|ce jour|en cours|heute";
const POINT = `(?:(${MONTH_RE})\\s*|(\\d{1,2})[/.-])?((?:19|20)\\d{2})`;
const RANGE = new RegExp(`${POINT}\\s*(?:-|–|—|to|a|au|until|bis|>)\\s*(?:${POINT}|(${NOW_RE}))`, "gi");

const EXP_HEAD = /^\s*(professional experience|work experience|experience professionnelle|experiences professionnelles|experiences|experience|employment|work history|career|parcours professionnel|berufserfahrung)\b/i;
const OTHER_HEAD = /^\s*(education|formation|formations|academic|etudes|diplomes|skills|competences|languages|langues|interests|centres d'interet|hobbies|certifications|projects|projets|associati|extra-curricular|activites|references|ausbildung|kenntnisse)\b/i;

function experienceSection(text) {
  const lines = normalize(text).split(/\n/);
  let inExp = false, found = false;
  const out = [];
  for (const l of lines) {
    if (l.length < 60 && EXP_HEAD.test(l)) { inExp = true; found = true; continue; }
    if (l.length < 60 && OTHER_HEAD.test(l)) { inExp = false; continue; }
    if (inExp) out.push(l);
  }
  return found ? out.join("\n") : null;
}

function toMonth(monthName, monthNum, year) {
  let m = 0;
  if (monthName) m = MONTHS[monthName.replace(".", "").toLowerCase()] ?? 0;
  else if (monthNum) m = Math.min(11, Math.max(0, Number(monthNum) - 1));
  return Number(year) * 12 + m;
}

export function estimateYears(text) {
  const norm = normalize(text);
  const explicit = [...norm.matchAll(/(\d{1,2})\+?\s*(?:years?|ans|jahre)\s*(?:of\s*|d')?(?:professional\s*)?(?:experience|experience professionnelle|berufserfahrung)/g)]
    .map((m) => Number(m[1]));

  const scope = experienceSection(text) ?? norm;
  const now = new Date();
  const nowM = now.getFullYear() * 12 + now.getMonth();
  const spans = [];
  for (const m of scope.matchAll(RANGE)) {
    const start = toMonth(m[1], m[2], m[3]);
    const end = m[7] ? nowM : toMonth(m[4], m[5], m[6]) + (m[4] || m[5] ? 0 : 11);
    if (end >= start && end - start < 12 * 40 && start <= nowM) spans.push([start, Math.min(end, nowM)]);
  }
  // Merge overlapping periods so two jobs at once are not counted twice.
  spans.sort((a, b) => a[0] - b[0]);
  let total = 0, cur = null;
  for (const s of spans) {
    if (!cur || s[0] > cur[1]) { if (cur) total += cur[1] - cur[0] + 1; cur = [...s]; }
    else cur[1] = Math.max(cur[1], s[1]);
  }
  if (cur) total += cur[1] - cur[0] + 1;
  const fromDates = Math.round((total / 12) * 2) / 2;
  return Math.min(40, Math.max(fromDates, ...explicit, 0));
}

// First short line that looks like a job title / headline (not a name, email or phone).
function guessRole(text) {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean).slice(0, 12);
  const hint = /(intern|internship|stage|stagiaire|alternance|apprenti|analyst|analyste|manager|assistant|consultant|developer|developpeur|engineer|ingenieur|designer|marketing|sales|commercial|finance|student|etudiant|chef de projet|business|data|comptable|serveur|vendeur|hote)/i;
  const line = lines.find((l) => l.length < 70 && !/@|\+?\d[\d .]{7,}|linkedin|http/i.test(l) && hint.test(normalize(l)));
  return line ? line.replace(/\s{2,}/g, " ").replace(/[|•·].*$/, "").trim() : "";
}

export function parseCv(text) {
  const skills = [...extractSkills(text)];
  const suggestions = suggestRoles(text, skills);
  // Prefer a real job title from the headline ("Data analyst"); otherwise the job family
  // detected from headline + skills. A headline like "MSc student" is never used as is.
  const headline = guessRole(text);
  const headlineIsTitle = headline && cleanRole(headline).split(" ").length <= 4 && familiesIn(cleanRole(headline)).length === 1
    && !/student|etudiant|master|msc|bba|mba|school|ecole/i.test(headline);
  return {
    text,
    skills,
    years: estimateYears(text),
    role: headlineIsTitle ? headline : suggestions[0] || "",
    suggestions,
  };
}
