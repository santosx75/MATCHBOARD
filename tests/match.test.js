import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSkills } from "../public/js/skills.js";
import { classifyContracts } from "../public/js/contracts.js";
import { prepareJobs, scoreJobs, requiredYears, distanceKm } from "../public/js/match.js";
import { parseCv, estimateYears } from "../public/js/cv.js";
import { SAMPLE_JOBS } from "../public/js/demo.js";
import { cleanLocation } from "../lib/geo.js";
import { htmlToText } from "../lib/sources.js";

const CV = `Camille Martin
Marketing & Business student — BBA
camille@example.com · +33 6 12 34 56 78

EXPERIENCE
Marketing Intern, Maison X — Jan 2024 - Jun 2024
Social media campaigns on Instagram and TikTok, Google Analytics reporting, content creation.
Sales assistant (part-time), Urban Store — 09/2022 - 12/2023
Customer service, cashier, visual merchandising.

EDUCATION
Business School 2021 - 2025

SKILLS
Excel, PowerPoint, Canva, SEO, CRM (HubSpot), SQL basics
Languages: French (native), English (C1), Spanish (B1)
Teamwork, creativity, autonomy`;

test("extracts skills from a CV", () => {
  const s = extractSkills(CV);
  for (const k of ["Excel", "PowerPoint", "Canva", "SEO", "HubSpot", "SQL", "English", "French", "Spanish", "Social media", "Google Analytics", "CRM"]) {
    assert.ok(s.has(k), `missing ${k}`);
  }
  assert.ok(!s.has("R"), "lowercase 'r' must not match R");
  assert.ok(!s.has("Java"), "javascript-like words must not match Java");
});

test("acronyms only match in upper case", () => {
  assert.ok(extractSkills("Strong UX and UI skills").has("UX / UI design"));
  assert.ok(!extractSkills("we build ui for you").has("UX / UI design"));
  assert.ok(extractSkills("Statistics with R and Python").has("R"));
});

test("estimates years of experience from the experience section only", () => {
  const y = estimateYears(CV);
  // Jan–Jun 2024 (6 months) + Sep 2022–Dec 2023 (16 months) = 22 months ≈ 2 years; education dates ignored.
  assert.ok(y >= 1.5 && y <= 2.5, `got ${y}`);
});

test("guesses a role from the headline", () => {
  assert.match(parseCv(CV).role, /Marketing/);
});

test("classifies contract types", () => {
  const c = (title, description = "", hints = []) => classifyContracts({ title, description, contractHints: hints });
  assert.deepEqual(c("Stage Marketing 6 mois"), ["internship"]);
  assert.ok(c("Alternance – Business Developer").includes("apprenticeship"));
  assert.ok(c("Serveur", "Nous recherchons des extras en restauration").includes("extras"));
  assert.ok(c("Vendeur", "Contrat à durée indéterminée").includes("cdi"));
  assert.ok(c("Hôte d'accueil", "", ["SAI"]).includes("seasonal"));
  assert.ok(c("Developer", "", ["MIS"]).includes("interim"));
  assert.ok(c("Designer", "", ["freelance"]).includes("freelance"));
  assert.ok(!c("Analyst at an early-stage startup").includes("internship"), "'early-stage' is not an internship");
  assert.deepEqual(c("Analyst"), ["other"]);
});

test("reads required years", () => {
  assert.equal(requiredYears({ title: "PM", description: "You have 5+ years of experience in product." }), 5);
  assert.equal(requiredYears({ title: "Junior analyst", description: "" }), 0);
  assert.equal(requiredYears({ title: "Analyst", description: "Founded 10 years ago." }), null);
});

test("best-fitting offers rank first", () => {
  const profile = { ...parseCv(CV), role: "Marketing intern" };
  const ranked = scoreJobs(prepareJobs(SAMPLE_JOBS), profile).sort((a, b) => b.score - a.score);
  assert.match(ranked[0].title, /Marketing Intern/);
  const senior = ranked.find((j) => /Senior/.test(j.title));
  const warehouse = ranked.find((j) => /commandes/.test(j.title));
  assert.ok(ranked[0].score > senior.score && ranked[0].score > warehouse.score);
  for (const j of ranked) assert.ok(j.score >= 0 && j.score <= 100);
});

test("distance", () => {
  const d = distanceKm({ lat: 48.8566, lon: 2.3522 }, { lat: 49.0364, lon: 2.0761 }); // Paris–Cergy
  assert.ok(d > 25 && d < 30, `got ${d}`);
  assert.equal(distanceKm(null, { lat: 1, lon: 1 }), null);
});

test("server helpers", () => {
  assert.equal(cleanLocation("75 - Paris 8e Arrondissement"), "Paris");
  assert.equal(cleanLocation("Munich, Bavaria"), "Munich");
  assert.equal(cleanLocation("Remote"), "");
  assert.equal(htmlToText("&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;"), "Hello & welcome");
  assert.equal(htmlToText("<ul><li>One</li><li>Two</li></ul>"), "• One\n• Two");
});
