// Portfolio scripts
// - Repo grid (with filters and exclusions)
// - Research citations popup (APA/MLA/Harvard), static metrics (no scraping)

// ----------------- Repo grid -----------------
const USER = "JethroKimande";
// Repositories to exclude by exact name (case-insensitive)
const BLOCKED_NAMES = new Set(["jethro-portfolio", "jethro-kimande-cv"]);

const els = {
  grid: document.getElementById("repo-grid"),
  empty: document.getElementById("repo-empty"),
  error: document.getElementById("repo-error"),
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  forks: document.getElementById("includeForks"),
  archived: document.getElementById("includeArchived"),
  count: document.getElementById("count"),
};

let allRepos = [];
let view = [];

initRepos().catch(err => {
  console.error(err);
  if (els.error) els.error.hidden = false;
});

async function initRepos() {
  if (!els.grid) return; // page doesn't have the repo section
  allRepos = await fetchAllRepos(USER);

  // Listeners
  ["input", "change"].forEach(ev => {
    els.search?.addEventListener(ev, applyRepoFilters);
    els.sort?.addEventListener(ev, applyRepoFilters);
    els.forks?.addEventListener(ev, applyRepoFilters);
    els.archived?.addEventListener(ev, applyRepoFilters);
  });

  applyRepoFilters();
}

function applyRepoFilters() {
  const q = (els.search?.value || "").trim().toLowerCase();
  const includeForks = !!els.forks?.checked;
  const includeArchived = !!els.archived?.checked;
  const sort = els.sort?.value || "updated";

  view = allRepos.filter(r => {
    if (r.name && r.name.toLowerCase().startsWith("plp")) return false;
    if (r.name && BLOCKED_NAMES.has(r.name.toLowerCase())) return false;
    if (!includeForks && r.fork) return false;
    if (!includeArchived && r.archived) return false;
    if (q) {
      const hay = `${r.name} ${r.description ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  sortRepos(view, sort);
  renderRepos(view);
}

function sortRepos(list, key) {
  switch (key) {
    case "stars":
      list.sort((a,b) => (b.stargazers_count||0) - (a.stargazers_count||0)); break;
    case "name":
      list.sort((a,b) => a.name.localeCompare(b.name)); break;
    case "updated":
    default:
      list.sort((a,b) => new Date(b.pushed_at) - new Date(a.pushed_at));
  }
}

function renderRepos(list) {
  if (!els.grid) return;
  els.grid.innerHTML = "";
  if (els.count) els.count.textContent = `${list.length} repos`;

  if (!list.length) {
    if (els.empty) els.empty.hidden = false;
    return;
  } else {
    if (els.empty) els.empty.hidden = true;
  }

  const frag = document.createDocumentFragment();
  list.forEach(r => frag.appendChild(repoCard(r)));
  els.grid.appendChild(frag);
}

function repoCard(r) {
  const card = el("article", "card repo-card");

  const top = el("div", "top");
  const name = a(r.html_url, r.name);
  const chips = el("div");
  if (r.fork) chips.appendChild(chip("Fork"));
  if (r.archived) chips.appendChild(chip("Archived", "warn"));
  top.append(name, chips);

  const desc = el("div", "desc", r.description || "No description provided.");
  const meta = el("div", "repo-meta");
  if (r.language) meta.append(spanLang(r.language));
  meta.append(text(`⭐ ${r.stargazers_count || 0}`));
  meta.append(text(`🍴 ${r.forks_count || 0}`));
  meta.append(text(`Updated ${timeAgo(r.pushed_at)}`));

  const links = el("div", "card__links");
  links.append(a(r.html_url, "Repository"));
  if (r.homepage) {
    const url = r.homepage.startsWith("http") ? r.homepage : `https://${r.homepage}`;
    links.append(a(url, "Live"));
  }

  card.append(top, desc, meta, links);
  return card;
}

async function fetchAllRepos(user) {
  const per_page = 100;
  let page = 1;
  let all = [];
  while (true) {
    const url = `https://api.github.com/users/${user}/repos?per_page=${per_page}&page=${page}&sort=updated`;
    const res = await fetch(url, { headers: { "Accept": "application/vnd.github+json" } });
    if (!res.ok) throw new Error("Failed to fetch repos: " + res.status);
    const batch = await res.json();
    all = all.concat(batch);
    if (batch.length < per_page) break;
    if (++page > 10) break; // safety
  }
  return all;
}

// ----------------- Research: static metrics + citations -----------------

// Set your publication metadata here for accurate citations
const CITATION_META = {
  title: "Application of Infrared Thermography in Fault Detection and Preventive Maintenance in Three‑Phase Distribution Transformers",
  authors: [], // e.g., ["Kimande, J.", "Doe, A. B."] or ["Jethro Kimande"] — free-form names accepted
  year: "2021", // use the actual year if known, otherwise "n.d."
  venue: "ResearchGate",
  url: "https://www.researchgate.net/publication/348535061_Application_of_Infrared_Thermography_in_Fault_Detection_and_Preventive_Maintenance_in_Three-Phase_Distribution_Transformers",
};

const citeEls = {
  overlay: document.getElementById("cite-overlay"),
  open: document.getElementById("cite-open"),
  close: document.getElementById("cite-close"),
  apa: document.getElementById("cite-apa"),
  mla: document.getElementById("cite-mla"),
  harvard: document.getElementById("cite-harvard"),
};

initCitations();

function initCitations() {
  // Build citation strings now (no network)
  updateCitationsUI(CITATION_META);

  // Wire up popup
  citeEls.open?.addEventListener("click", openCite);
  citeEls.close?.addEventListener("click", closeCite);
  const panel = document.querySelector("#cite-overlay .overlay__panel");
  panel?.addEventListener("click", (e) => e.stopPropagation());
  citeEls.overlay?.addEventListener("click", closeCite);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !citeEls.overlay?.hidden) closeCite();
  });

  // Copy buttons
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fmt = btn.getAttribute("data-format");
      const text =
        fmt === "apa" ? citeEls.apa?.textContent :
        fmt === "mla" ? citeEls.mla?.textContent :
        fmt === "harvard" ? citeEls.harvard?.textContent : "";
      copyToClipboard(text || "").then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1200);
      }).catch(() => {
        btn.textContent = "Copy failed";
        setTimeout(() => (btn.textContent = "Copy"), 1200);
      });
    });
  });
}

function openCite() {
  if (!citeEls.overlay) return;
  citeEls.overlay.hidden = false;
  citeEls.overlay.setAttribute("aria-hidden", "false");
}

function closeCite() {
  if (!citeEls.overlay) return;
  citeEls.overlay.hidden = true;
  citeEls.overlay.setAttribute("aria-hidden", "true");
}

function updateCitationsUI(meta) {
  const { apa, mla, harvard } = buildCitations(meta);
  if (citeEls.apa) citeEls.apa.textContent = apa;
  if (citeEls.mla) citeEls.mla.textContent = mla;
  if (citeEls.harvard) citeEls.harvard.textContent = harvard;
}

function buildCitations(meta) {
  const title = meta.title || "Untitled";
  const url = meta.url || "";
  const year = meta.year || "n.d.";
  const venue = meta.venue || "Repository";
  const authorsRaw = Array.isArray(meta.authors) ? meta.authors : [];
  const authors = authorsRaw.map(normalizeName).filter(Boolean);

  const apaAuthors = authors.length ? formatAuthorsAPA(authors) : "[Author(s) unknown]";
  const mlaAuthors = authors.length ? formatAuthorsMLA(authors) : "[Author(s) unknown]";
  const harvAuthors = authors.length ? formatAuthorsHarvard(authors) : "[Author(s) unknown]";

  const accessed = new Date();
  const accessedStr = `${accessed.getDate()} ${monthName(accessed.getMonth())} ${accessed.getFullYear()}`;

  const apa = `${apaAuthors} (${year}). ${title}. ${venue}. ${url}`;
  const mla = `${mlaAuthors}. “${title}.” ${venue}, ${year}, ${url}.`;
  const harvard = `${harvAuthors} ${year}. ${title}. ${venue}. Available at: ${url} (Accessed ${accessedStr}).`;

  return { apa, mla, harvard };
}

function normalizeName(n) {
  if (typeof n !== "string") return "";
  return n.trim().replace(/\s+/g, " ");
}
function invertName(full) {
  const tokens = full.trim().split(/\s+/);
  if (tokens.length === 1) return tokens[0];
  const last = tokens.pop();
  return `${last}, ${tokens.join(" ")}`;
}
function toSurnameInitials(full) {
  const tokens = full.trim().split(/\s+/);
  if (tokens.length === 1) return tokens[0];
  const last = tokens.pop();
  const initials = tokens.map(t => t[0]?.toUpperCase() + ".").join(" ");
  return `${last}, ${initials}`;
}
function formatAuthorsAPA(list) {
  // "Surname, N., Surname, N., & Surname, N."
  const parts = list.map(toSurnameInitials);
  if (parts.length <= 2) return parts.join(" & ");
  return parts.slice(0, -1).join(", ") + ", & " + parts.slice(-1);
}
function formatAuthorsMLA(list) {
  // "Surname, First, and Surname, First" or "Surname, First, et al."
  if (list.length === 1) return invertName(list[0]);
  if (list.length === 2) return `${invertName(list[0])}, and ${invertName(list[1])}`;
  return `${invertName(list[0])}, et al.`;
}
function formatAuthorsHarvard(list) {
  // "Surname, Initials., Surname, Initials., and Surname, Initials."
  const parts = list.map(toSurnameInitials);
  if (parts.length <= 2) return parts.join(" and ");
  return parts.slice(0, -1).join(", ") + ", and " + parts.slice(-1);
}
function monthName(m) {
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m];
}

async function copyToClipboard(text) {
  if (!text) return Promise.reject(new Error("Empty"));
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text; document.body.appendChild(ta);
  ta.select(); document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve();
}

// ----------------- Shared utils -----------------
function timeAgo(iso) {
  const t = typeof iso === "string" ? new Date(iso).getTime() : (iso?.getTime?.() ?? Date.now());
  const diff = Date.now() - t;
  const mins = Math.floor(diff/60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins/60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs/24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days/30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months/12);
  return `${years}y ago`;
}
function el(tag, cls, textContent){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (textContent) n.textContent = textContent;
  return n;
}
function a(href, label){
  const n = document.createElement("a");
  n.href = href; n.textContent = label; n.target = "_blank"; n.rel = "noopener";
  return n;
}
function text(t){ return document.createTextNode(t); }
function chip(label, tone){ const c = el("span", `chip${tone? " " + tone : ""}`, label); return c; }
function spanLang(lang){
  const s = el("span");
  s.append(text(lang));
  return s;
}