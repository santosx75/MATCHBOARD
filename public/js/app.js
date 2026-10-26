import { readCvFile, parseCv } from "./cv.js";
import { cleanRole } from "./roles.js";
import { SKILLS, skillByName } from "./skills.js";
import { CONTRACTS, OTHER, CONTRACT_BY_ID } from "./contracts.js";
import { prepareJobs, scoreJobs, distanceKm, remoteEligible } from "./match.js";
import { platformLinks } from "./platforms.js";
import { SAMPLE_JOBS } from "./demo.js";
import { mountCrowd } from "./crowd.js";
import { initScrollTilt } from "./scrollfx.js";
import { mountBackgroundPaths } from "./bgpaths.js";

const CROWD_SRC = "https://cdn.21st.dev/assets/localized/abdb8990a7bef8c2f5af3e45f0a3c969c4b0603fba8be92e81347de4ea4e1ed7.png";
const PAGE = 25;
const $ = (s, el = document) => el.querySelector(s);

const state = {
  profile: { text: "", fileName: "", skills: [], years: 0, role: "", suggestions: [], city: "", place: null },
  prepared: null,
  scored: [],
  view: [],
  shown: PAGE,
  sources: [],
  isSample: false,
  filters: { contracts: new Set(), radius: 50, remote: true, unknown: false, roleFit: true, sort: "match" },
};

/* ---------- Utilities ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (id, cls = "sm") => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const safeUrl = (u) => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function ago(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso)) / 864e5);
  if (!Number.isFinite(days) || days < 0) return "";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const m = Math.floor(days / 30);
  return m < 12 ? `${m} mo ago` : `${Math.floor(m / 12)} yr ago`;
}
let toastTimer;
// Optional action button (e.g. "Undo"). Toasts with an action stay a bit longer.
function toast(msg, action) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ""}`;
  if (action) t.querySelector("button").addEventListener("click", () => { t.hidden = true; action.run(); }, { once: true });
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), action ? 6000 : 3500);
}
function scoreRing(score, size = 60) {
  const r = 26, c = 2 * Math.PI * r;
  return `<div class="score" style="width:${size}px;height:${size}px" aria-label="${score}% match">
    <svg viewBox="0 0 60 60" aria-hidden="true"><circle class="bg" cx="30" cy="30" r="${r}"/><circle class="fg" cx="30" cy="30" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score / 100)}"/></svg>
    <b>${score}<small>%</small></b></div>`;
}

/* ---------- Theme ---------- */
function initTheme() {
  const btn = $("#theme-toggle");
  const isDark = () => document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  const label = () => btn.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
  label();
  btn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("mb-theme", next); } catch { /* ignore */ }
    label();
  });
}

/* ---------- Glass pointer highlight ---------- */
function initGlassGlow() {
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest?.(".glass-hit");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, { passive: true });
}

/* ---------- Step 1: upload ---------- */
function initUpload() {
  const dz = $("#dropzone"), input = $("#cv-input");
  input.addEventListener("change", () => input.files[0] && handleFile(input.files[0]));
  ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("is-over"); }));
  dz.addEventListener("drop", (e) => { const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); });
  // Dropping a file outside the zone should not navigate away.
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  const toggle = $("#paste-toggle"), area = $("#paste-area");
  toggle.addEventListener("click", () => {
    area.hidden = !area.hidden;
    toggle.setAttribute("aria-expanded", String(!area.hidden));
    if (!area.hidden) $("#cv-text").focus();
  });
  $("#paste-go").addEventListener("click", () => {
    const text = $("#cv-text").value.trim();
    if (text.length < 30) return uploadError("Paste a bit more of your CV (at least a few lines).");
    applyCv(text, "Pasted CV");
    area.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  });
  $("#cv-remove").addEventListener("click", removeCv);
}

const hasCv = () => !!(state.profile.fileName || state.profile.text || state.profile.skills.length);

// Shows which CV is loaded next to the drop zone, with its Remove button.
function renderCvLoaded() {
  const on = hasCv();
  $("#cv-loaded").hidden = !on;
  $("#upload").classList.toggle("has-cv", on);
  $(".dz-title").textContent = on ? "Drop a new CV to replace it" : "Drop your CV here";
  if (!on) return;
  const p = state.profile;
  $("#cv-loaded-name").textContent = p.fileName || "Your CV";
  const n = p.skills.length;
  $("#cv-loaded-meta").textContent = `${n} skill${n === 1 ? "" : "s"} · ${p.years || 0} yr${p.years === 1 ? "" : "s"} experience`;
}

// Removes the scanned CV, its skills and its results. Location is kept. Undo restores everything.
function removeCv() {
  const snapshot = {
    profile: structuredClone(state.profile),
    scored: state.scored, prepared: state.prepared, view: state.view, sources: state.sources, isSample: state.isSample,
    profileHidden: $("#profile").hidden, resultsHidden: $("#results").hidden,
    listHtml: $("#job-list").innerHTML, summary: $("#results-summary").textContent,
  };
  Object.assign(state.profile, { text: "", fileName: "", skills: [], years: 0, role: "", suggestions: [] });
  Object.assign(state, { scored: [], prepared: null, view: [], sources: [], isSample: false, shown: PAGE });
  $("#cv-text").value = "";
  $("#job-list").innerHTML = "";
  $("#results-summary").textContent = "";
  $("#more-btn").hidden = true;
  $("#profile").hidden = true;
  $("#results").hidden = true;
  $("#role-error").hidden = true;
  uploadError("");
  renderProfile();
  renderPlatforms();
  saveProfile();
  $("#cv-input").focus({ preventScroll: true });

  toast("CV removed", {
    label: "Undo",
    run() {
      Object.assign(state.profile, snapshot.profile);
      Object.assign(state, { scored: snapshot.scored, prepared: snapshot.prepared, view: snapshot.view, sources: snapshot.sources, isSample: snapshot.isSample });
      $("#job-list").innerHTML = snapshot.listHtml;
      $("#results-summary").textContent = snapshot.summary;
      $("#profile").hidden = snapshot.profileHidden;
      $("#results").hidden = snapshot.resultsHidden;
      $("#more-btn").hidden = state.shown >= state.view.length;
      renderProfile();
      renderPlatforms();
      saveProfile();
    },
  });
}

function uploadError(msg) {
  const e = $("#upload-error");
  e.textContent = msg;
  e.hidden = !msg;
}

async function handleFile(file) {
  uploadError("");
  $("#upload-progress").hidden = false;
  try {
    const text = await readCvFile(file);
    if (!text || text.trim().length < 30) throw new Error("We couldn't read text from this file. Try another format or paste the text.");
    applyCv(text, file.name);
  } catch (err) {
    uploadError(err.message || "Could not read this file.");
  } finally {
    $("#upload-progress").hidden = true;
    $("#cv-input").value = "";
  }
}

function applyCv(text, fileName) {
  const parsed = parseCv(text);
  Object.assign(state.profile, {
    text, fileName,
    skills: parsed.skills,
    years: parsed.years,
    role: parsed.role || state.profile.role,
    suggestions: parsed.suggestions,
  });
  renderProfile();
  saveProfile();
  showSection("#profile");
  toast(`${parsed.skills.length} skills found in your CV`);
  if (!$("#role").value) setTimeout(() => $("#role").focus({ preventScroll: true }), 400);
}

/* ---------- Step 2: profile ---------- */
function renderProfile() {
  const p = state.profile;
  $("#cv-name").textContent = p.fileName || "your CV";
  $("#role").value = p.role || "";
  $("#years").value = p.years ?? 0;
  $("#city").value = p.place?.name || p.city || "";
  renderSkills();
  renderRoleSuggestions();
}

// Job families detected in the CV, as one-click role choices.
function renderRoleSuggestions() {
  const list = state.profile.suggestions || [];
  $("#role-suggest").hidden = !list.length;
  const current = $("#role").value.trim().toLowerCase();
  $("#role-chips").innerHTML = list.map((r) =>
    `<button type="button" class="cchip" data-role="${esc(r)}" aria-pressed="${r.toLowerCase() === current}">${esc(r)}</button>`).join("");
}

function renderSkills() {
  const list = $("#skills-list");
  const skills = state.profile.skills;
  $("#skills-count").textContent = skills.length;
  list.innerHTML = skills.length
    ? skills.map((s) => `<li class="chip">${esc(s)}<button type="button" data-remove="${esc(s)}" aria-label="Remove ${esc(s)}">${icon("x")}</button></li>`).join("")
    : `<li class="chips-empty">No skills detected yet — add a few below.</li>`;
  renderCvLoaded();
}

function addSkill(raw) {
  const v = raw.trim();
  if (!v) return;
  const known = skillByName(v);
  const name = known ? known.name : v.slice(0, 40);
  if (!state.profile.skills.some((s) => s.toLowerCase() === name.toLowerCase())) state.profile.skills.push(name);
  renderSkills();
  saveProfile();
}

function initProfile() {
  $("#skill-options").innerHTML = SKILLS.map((s) => `<option value="${esc(s.name)}">`).join("");
  $("#skills-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    state.profile.skills = state.profile.skills.filter((s) => s !== b.dataset.remove);
    renderSkills();
    saveProfile();
  });
  const add = () => { addSkill($("#skill-add").value); $("#skill-add").value = ""; $("#skill-add").focus(); };
  $("#skill-add-btn").addEventListener("click", add);
  $("#skill-add").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });

  $("#city").addEventListener("input", () => { state.profile.place = null; $("#city-error").hidden = true; });
  $("#role").addEventListener("blur", () => { if ($("#role").value.trim()) $("#role-error").hidden = true; });
  $("#locate-btn").addEventListener("click", locateMe);
  $("#role-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-role]");
    if (!b) return;
    $("#role").value = b.dataset.role;
    state.profile.role = b.dataset.role;
    $("#role-error").hidden = true;
    renderRoleSuggestions();
    renderPlatforms();
    saveProfile();
  });
  $("#role").addEventListener("input", () => renderRoleSuggestions());
  $("#profile-form").addEventListener("submit", (e) => { e.preventDefault(); runSearch(); });
}

function saveProfile() {
  const p = state.profile;
  store.set("mb-profile", { skills: p.skills, years: p.years, role: p.role, suggestions: p.suggestions, city: p.city, place: p.place, fileName: p.fileName });
}

async function locateMe() {
  const btn = $("#locate-btn");
  if (!navigator.geolocation) return cityError("Location is not available in this browser. Type your city instead.");
  btn.setAttribute("aria-busy", "true");
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    let name = "My location";
    try {
      const r = await fetch(`https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&fields=nom`);
      const c = (await r.json())[0];
      if (c?.nom) name = c.nom;
    } catch { /* outside France or offline */ }
    state.profile.place = { name, lat, lon, country: name === "My location" ? "" : "FR" };
    state.profile.city = name;
    $("#city").value = name;
    $("#city-error").hidden = true;
    btn.removeAttribute("aria-busy");
  }, () => {
    btn.removeAttribute("aria-busy");
    cityError("We couldn't get your location. Allow location access or type your city.");
  }, { timeout: 10000, maximumAge: 600000 });
}

function cityError(msg) {
  const e = $("#city-error");
  e.textContent = msg;
  e.hidden = false;
}

async function resolveCity() {
  const city = $("#city").value.trim();
  state.profile.city = city;
  if (!city) { state.profile.place = null; return true; }
  if (state.profile.place && state.profile.place.name === city) return true;
  try {
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(city)}`);
    if (!r.ok) throw new Error();
    state.profile.place = await r.json();
    return true;
  } catch {
    cityError(`We couldn't find "${city}". Check the spelling or try a nearby city.`);
    $("#city").focus();
    return false;
  }
}

/* ---------- Search ---------- */
async function runSearch() {
  const role = $("#role").value.trim();
  state.profile.role = role;
  state.profile.years = Number($("#years").value) || 0;
  if (!role) {
    $("#role-error").hidden = false;
    $("#role").focus();
    return;
  }
  const btn = $("#search-btn");
  btn.setAttribute("aria-busy", "true");
  btn.disabled = true;
  try {
    if (!(await resolveCity())) return;
    saveProfile();
    showSection("#results");
    renderSkeleton();
    // Search the boards with the first role, without degree/contract words ("MSc", "intern"...).
    const first = role.split(/[,/]/)[0].trim();
    const keywords = cleanRole(first) || first;
    let data;
    try {
      const r = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, location: state.profile.place, radius: state.filters.radius }),
      });
      if (!r.ok) throw new Error(String(r.status));
      data = await r.json();
    } catch {
      state.sources = [];
      renderSources();
      return renderEmpty("server");
    }
    state.sources = data.status || [];
    state.isSample = false;
    renderSources();
    setJobs(data.jobs || []);
  } finally {
    btn.removeAttribute("aria-busy");
    btn.disabled = false;
  }
}

function setJobs(jobs) {
  state.prepared = prepareJobs(jobs);
  state.scored = scoreJobs(state.prepared, state.profile).map((j) => ({ ...j, distance: distanceKm(state.profile.place, j) }));
  state.shown = PAGE;
  updateRadiusUi();
  renderPlatforms();
  applyFilters();
}

function loadSamples() {
  state.isSample = true;
  state.sources = [{ id: "sample", label: "Sample offers (fictional)", ok: true, count: SAMPLE_JOBS.length }];
  if (!state.profile.place) {
    state.profile.place = { name: "Paris", lat: 48.8566, lon: 2.3522, country: "FR" };
    state.profile.city = "Paris";
    $("#city").value = "Paris"; // keep the field in sync so the next search keeps this location
  }
  renderSources();
  setJobs(SAMPLE_JOBS);
  toast("Showing fictional sample offers");
}

/* ---------- Filters ---------- */
// Below this, the offer title has nothing to do with the target role (see roles.js).
const ROLE_FIT_MIN = 0.4;

function locationFiltered() {
  const { radius, remote, unknown, roleFit } = state.filters;
  const hasPlace = !!state.profile.place;
  return state.scored.filter((j) => {
    if (roleFit && j.roleFit < ROLE_FIT_MIN) return false;
    if (j.remote && !remoteEligible(j, state.profile.place)) return false;
    if (j.remote && remote && (j.distance == null || !hasPlace)) return true;
    if (!hasPlace) return remote || !j.remote;
    if (j.distance == null) return unknown;
    if (j.distance <= radius) return true;
    return j.remote && remote;
  });
}

function applyFilters() {
  const base = locationFiltered();
  const sel = state.filters.contracts;
  let list = sel.size ? base.filter((j) => j.contracts.some((c) => sel.has(c))) : base;
  const sorters = {
    match: (a, b) => b.score - a.score || (a.distance ?? 1e9) - (b.distance ?? 1e9),
    recent: (a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0) || b.score - a.score,
    distance: (a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9) || b.score - a.score,
  };
  list = [...list].sort(sorters[state.filters.sort]);
  state.view = list;
  renderContractChips(base);
  renderJobs();
  renderNotice();
  const badge = $("#filter-badge");
  badge.hidden = !sel.size;
  badge.textContent = sel.size;
  store.set("mb-filters", { ...state.filters, contracts: [...sel] });
}

// Explains thin results: without France Travail / Adzuna keys, the free boards have
// few offers in France, so a city search often finds little that fits.
function renderNotice() {
  const n = $("#results-notice");
  const inFrance = state.profile.place?.country === "FR";
  const frenchSource = state.sources.some((s) => (s.id === "francetravail" || s.id === "adzuna") && s.ok);
  const local = state.view.filter((j) => !j.remote).length;
  const show = !state.isSample && state.scored.length > 0 && inFrance && !frenchSource && local < 10;
  n.hidden = !show;
  if (show) {
    n.textContent = `Only ${local} on-site offer${local === 1 ? "" : "s"} near ${state.profile.place.name} for this role. ` +
      "The free job boards have few French offers: add the free France Travail and Adzuna keys to get thousands more, " +
      "or use the big platforms below.";
  }
}

function renderContractChips(base) {
  const counts = new Map();
  for (const j of base) for (const c of j.contracts) counts.set(c, (counts.get(c) || 0) + 1);
  const sel = state.filters.contracts;
  $("#contract-chips").innerHTML = [...CONTRACTS, OTHER].map((c) => {
    const n = counts.get(c.id) || 0;
    if (c.id === "other" && !n) return "";
    return `<button type="button" class="cchip" data-contract="${c.id}" aria-pressed="${sel.has(c.id)}" data-empty="${n === 0}">
      <span>${esc(c.label)}${c.id !== "vie" && c.id !== "other" ? ` <i>${esc(c.sub)}</i>` : ""}</span><small aria-label="${n} offers">${n}</small></button>`;
  }).join("");
}

function updateRadiusUi() {
  const r = $("#radius");
  const v = Number(r.value);
  r.style.setProperty("--p", `${((v - 1) / 199) * 100}%`);
  $("#radius-out").textContent = `${v} km`;
  const has = !!state.profile.place;
  r.disabled = !has;
  $("#radius-from").textContent = has ? state.profile.place.name : "— add a city in your profile";
}

function initFilters() {
  const saved = store.get("mb-filters", null);
  if (saved) {
    // Contract choices are per search: restoring them would silently narrow the next search.
    const { radius, remote, unknown, roleFit, sort } = saved;
    Object.assign(state.filters, { radius: radius ?? 50, remote: remote ?? true, unknown: !!unknown, roleFit: roleFit ?? true, sort: sort || "match" });
    $("#radius").value = state.filters.radius;
    $("#opt-remote").checked = state.filters.remote;
    $("#opt-unknown").checked = state.filters.unknown;
    $("#opt-rolefit").checked = state.filters.roleFit;
    $("#sort").value = state.filters.sort;
  }
  updateRadiusUi();
  const refilter = debounce(() => { state.shown = PAGE; applyFilters(); }, 80);

  $("#contract-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-contract]");
    if (!b) return;
    const id = b.dataset.contract, sel = state.filters.contracts;
    sel.has(id) ? sel.delete(id) : sel.add(id);
    state.shown = PAGE;
    applyFilters();
    $(`[data-contract="${id}"]`)?.focus();
  });
  $("#radius").addEventListener("input", (e) => { state.filters.radius = Number(e.target.value); updateRadiusUi(); refilter(); renderPlatforms(); });
  $("#opt-remote").addEventListener("change", (e) => { state.filters.remote = e.target.checked; refilter(); });
  $("#opt-unknown").addEventListener("change", (e) => { state.filters.unknown = e.target.checked; refilter(); });
  $("#opt-rolefit").addEventListener("change", (e) => { state.filters.roleFit = e.target.checked; refilter(); });
  $("#sort").addEventListener("change", (e) => { state.filters.sort = e.target.value; refilter(); });
  $("#reset-filters").addEventListener("click", () => {
    Object.assign(state.filters, { contracts: new Set(), radius: 50, remote: true, unknown: false, roleFit: true, sort: "match" });
    $("#radius").value = 50; $("#opt-remote").checked = true; $("#opt-unknown").checked = false; $("#opt-rolefit").checked = true; $("#sort").value = "match";
    updateRadiusUi();
    applyFilters();
    renderPlatforms();
  });

  // Mobile sheet
  const panel = $("#filters"), scrim = $("#scrim");
  const open = () => { panel.classList.add("is-open"); scrim.hidden = false; $("#close-filters").focus(); };
  const close = () => { panel.classList.remove("is-open"); scrim.hidden = true; $("#open-filters").focus(); };
  $("#open-filters").addEventListener("click", open);
  $("#close-filters").addEventListener("click", close);
  $("#apply-filters").addEventListener("click", close);
  scrim.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panel.classList.contains("is-open")) close(); });

  $("#more-btn").addEventListener("click", () => { state.shown += PAGE; renderJobs(true); });
  $("#edit-profile").addEventListener("click", () => showSection("#profile"));
}

/* ---------- Results rendering ---------- */
function renderSkeleton() {
  $("#job-list").setAttribute("aria-busy", "true");
  $("#job-list").innerHTML = Array.from({ length: 5 }, () => `<div class="skeleton"></div>`).join("");
  $("#results-summary").textContent = "Searching job boards…";
  $("#more-btn").hidden = true;
}

function renderSources() {
  $("#source-status").innerHTML = state.sources.length
    ? state.sources.map((s) => `<li class="${s.ok ? "" : "off"}"><span class="dot"></span>${esc(s.label)}<small>${s.ok ? s.count : "offline"}</small></li>`).join("")
    : `<li class="off"><span class="dot"></span>No source reached<small>—</small></li>`;
}

function jobCard(j, i) {
  const contracts = j.contracts.filter((c) => c !== "other").slice(0, 3).map((c) => `<span class="tag line">${esc(CONTRACT_BY_ID.get(c).label)}</span>`).join("");
  const dist = j.distance != null ? `<span>${icon("pin")} ${Math.round(j.distance)} km</span>` : "";
  const where = j.location ? `<span>${esc(j.location.length > 40 ? j.location.slice(0, 40) + "…" : j.location)}</span>` : "";
  const skills = j.matched.slice(0, 4).map((s) => `<span class="tag solid">${icon("check")} ${esc(s)}</span>`).join("");
  const more = j.matched.length > 4 ? `<span class="tag">+${j.matched.length - 4}</span>` : "";
  return `<article class="job glass glass-hit" tabindex="0" role="button" data-i="${i}" aria-label="${esc(j.title)} at ${esc(j.company || "unknown company")}, ${j.score}% match" style="animation-delay:${Math.min(i % PAGE, 10) * 30}ms">
    <span class="job-rank">#${i + 1}</span>
    ${scoreRing(j.score)}
    <div class="job-main">
      <h3 class="job-title">${esc(j.title)}</h3>
      <div class="job-meta">
        ${j.company ? `<span>${icon("briefcase")} ${esc(j.company)}</span>` : ""}
        ${where}${dist}
        ${j.remote ? `<span>${icon("globe")} Remote</span>` : ""}
        ${j.postedAt ? `<span>${icon("clock")} ${ago(j.postedAt)}</span>` : ""}
      </div>
    </div>
    <div class="job-tags">${contracts}${skills}${more}<span class="tag">${esc(j.sourceLabel)}</span></div>
  </article>`;
}

function renderJobs(append = false) {
  const list = $("#job-list");
  list.setAttribute("aria-busy", "false");
  const total = state.view.length, all = state.scored.length;
  if (!all) return renderEmpty(state.sources.some((s) => s.ok) ? "none" : "server");
  if (!total) return renderEmpty("filtered");
  const start = append ? list.querySelectorAll(".job").length : 0;
  const html = state.view.slice(start, state.shown).map((j, k) => jobCard(j, start + k)).join("");
  if (append) list.insertAdjacentHTML("beforeend", html); else list.innerHTML = html;
  const top = state.view[0];
  $("#results-summary").textContent = `${total} of ${all} offers${state.isSample ? " (sample data)" : ""} · best match ${top.score}%`;
  $("#more-btn").hidden = state.shown >= total;
}

function renderEmpty(kind) {
  const msgs = {
    server: ["Can't reach the job search", "The app server isn't running or you're offline. Start it with <code>node server.js</code>, or try the app with sample offers."],
    none: ["No offers found for this role", "Try a broader role (e.g. “Marketing” instead of “Junior brand marketing intern”), or try sample offers."],
    filtered: ["No offer matches these filters", "Widen the distance, include remote jobs, select fewer contract types, or turn off “Only offers matching my role”."],
  };
  const [title, body] = msgs[kind];
  $("#job-list").setAttribute("aria-busy", "false");
  $("#job-list").innerHTML = `<div class="empty glass"><h3>${title}</h3><p class="muted">${body}</p><div class="row">
    ${kind === "filtered" ? `<button class="btn primary" type="button" data-act="reset">Reset filters</button>` : `<button class="btn primary" type="button" data-act="sample">Try sample offers</button><button class="btn ghost" type="button" data-act="retry">Retry</button>`}
  </div></div>`;
  $("#results-summary").textContent = kind === "filtered" ? `0 of ${state.scored.length} offers` : "";
  $("#more-btn").hidden = true;
}

function initResults() {
  const list = $("#job-list");
  const open = (el) => {
    const j = state.view[Number(el.dataset.i)];
    if (!j) return;
    list.querySelectorAll(".is-selected").forEach((x) => x.classList.remove("is-selected"));
    el.classList.add("is-selected");
    openJob(j, el);
  };
  list.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "sample") return loadSamples();
    if (act === "retry") return runSearch();
    if (act === "reset") return $("#reset-filters").click();
    const card = e.target.closest(".job");
    if (card) open(card);
  });
  list.addEventListener("keydown", (e) => {
    const card = e.target.closest(".job");
    if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(card); }
  });
}

/* ---------- Job detail ---------- */
let lastCard = null;
function openJob(j, card) {
  lastCard = card;
  const dlg = $("#job-dialog");
  const b = j.breakdown;
  const bar = (label, v) => v == null ? "" : `<div class="bar"><span>${label}</span><span class="track"><span style="width:${v}%"></span></span><b>${v}%</b></div>`;
  const url = safeUrl(j.url);
  const contracts = j.contracts.map((c) => `<span class="tag line">${esc(CONTRACT_BY_ID.get(c).label)} · ${esc(CONTRACT_BY_ID.get(c).sub)}</span>`).join("");
  $("#dlg-body").innerHTML = `
    <div class="dlg-top">${scoreRing(j.score, 76)}<div>
      <h2 class="dlg-title" id="dlg-title">${esc(j.title)}</h2>
      <div class="job-meta">
        ${j.company ? `<span>${icon("briefcase")} ${esc(j.company)}</span>` : ""}
        ${j.location ? `<span>${icon("pin")} ${esc(j.location)}${j.distance != null ? ` · ${Math.round(j.distance)} km` : ""}</span>` : ""}
        ${j.remote ? `<span>${icon("globe")} Remote</span>` : ""}
        ${j.postedAt ? `<span>${icon("clock")} ${ago(j.postedAt)}</span>` : ""}
      </div></div></div>
    <div class="dlg-section"><div class="job-tags">${contracts}${j.salary ? `<span class="tag">${esc(j.salary)}</span>` : ""}<span class="tag">via ${esc(j.sourceLabel)}</span></div></div>
    <div class="dlg-section"><h3>Why this score</h3><div class="bars">
      ${bar("Skills", b.skills)}${bar("Job title", b.title)}${bar("Text match", b.text)}${bar("Experience", b.experience)}
    </div>${j.reqYears ? `<p class="hint">Asks for about ${j.reqYears} year${j.reqYears > 1 ? "s" : ""} of experience — you have ${state.profile.years}.</p>` : ""}</div>
    ${j.matched.length ? `<div class="dlg-section"><h3>Skills you have (${j.matched.length})</h3><div class="chips">${j.matched.map((s) => `<span class="chip soft">${icon("check")} ${esc(s)}</span>`).join("")}</div></div>` : ""}
    ${j.missing.length ? `<div class="dlg-section"><h3>Skills to highlight or learn (${j.missing.length})</h3><div class="chips">${j.missing.slice(0, 12).map((s) => `<span class="chip outline">${esc(s)}</span>`).join("")}</div></div>` : ""}
    <div class="dlg-section"><h3>Description</h3><p class="desc">${esc(j.description || "No description provided.")}</p></div>
    <div class="dlg-actions">
      ${url && !state.isSample
        ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Apply on ${esc(j.sourceLabel)} ${icon("external")}</a>`
        : `<button class="btn primary" type="button" disabled>${state.isSample ? "Sample offer — no link" : "No link available"}</button>`}
      <button class="btn ghost" type="button" data-close>Close</button>
    </div>`;
  dlg.showModal();
  dlg.querySelector(".sheet-inner").scrollTop = 0;
}

function initDialog() {
  const dlg = $("#job-dialog");
  const close = () => dlg.close();
  $("#dlg-close").addEventListener("click", close);
  dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) close(); });
  dlg.addEventListener("close", () => lastCard?.focus({ preventScroll: true }));
}

/* ---------- Platforms ---------- */
function renderPlatforms() {
  const links = platformLinks({
    role: state.profile.role || $("#role").value.trim(),
    city: state.profile.place?.name || state.profile.city || "",
    radius: state.filters.radius,
    contracts: [...state.filters.contracts],
  });
  $("#platform-grid").innerHTML = links.map((l) => `
    <a class="platform glass glass-hit" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
      <span class="pl-logo" aria-hidden="true">${esc(l.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2))}</span>
      <span><b>${esc(l.name)}</b><small>${esc(l.tag)}</small></span>
      ${icon("external", "")}
      <span class="visually-hidden">(opens in a new tab)</span>
    </a>`).join("");
}

/* ---------- Navigation ---------- */
function showSection(sel) {
  const el = $(sel);
  el.hidden = false;
  if (sel === "#results") $("#profile").hidden = false;
  requestAnimationFrame(() => el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
}

/* ---------- Boot ---------- */
function boot() {
  initTheme();
  initGlassGlow();
  initUpload();
  initProfile();
  initFilters();
  initResults();
  initDialog();

  const saved = store.get("mb-profile", null);
  if (saved?.skills?.length || saved?.role) {
    Object.assign(state.profile, saved);
    renderProfile();
    $("#profile").hidden = false;
  }
  renderPlatforms();
  $("#role").addEventListener("input", debounce(() => { state.profile.role = $("#role").value.trim(); renderPlatforms(); }, 300));

  initScrollTilt();
  mountBackgroundPaths($("#bottom-zone"));
  const start = () => mountCrowd($("#crowd"), { src: CROWD_SRC, rows: 15, cols: 7 });
  if (window.gsap) start(); else window.addEventListener("load", start, { once: true });
}

boot();
