// Portfolio scripts
// - Repo grid (with filters and exclusions)
// - Research citations popup (APA/MLA/Harvard), static metrics (no scraping)
// - Social sharing functionality
// - Enhanced contact form with AI features
// - Project demo modals
// - Performance optimizations

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

// ----------------- Social Sharing -----------------
function copyPortfolioUrl() {
  const url = window.location.href;
  copyToClipboard(url).then(() => {
    // Show success feedback
    const btn = document.querySelector('.copy-url');
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.style.background = 'var(--accent)';
    btn.style.color = 'white';
    btn.style.borderColor = 'var(--accent)';
    
    setTimeout(() => {
      btn.innerHTML = originalIcon;
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 2000);
  }).catch(() => {
    alert('Failed to copy URL. Please copy manually: ' + url);
  });
}

// ----------------- Enhanced Contact Form -----------------
function initContactForm() {
  const form = document.getElementById('contactForm');
  const messageTextarea = document.getElementById('message');
  const charCount = document.getElementById('charCount');
  const submitBtn = document.getElementById('submitBtn');
  const formStatus = document.getElementById('formStatus');
  
  if (!form) return;
  
  // Character counter
  if (messageTextarea && charCount) {
    messageTextarea.addEventListener('input', () => {
      const count = messageTextarea.value.length;
      charCount.textContent = count;
      
      if (count > 900) {
        charCount.style.color = 'var(--warn)';
      } else if (count > 800) {
        charCount.style.color = 'var(--accent)';
      } else {
        charCount.style.color = 'var(--muted)';
      }
    });
  }
  
  // Form submission with enhanced UX
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Show loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    formStatus.style.display = 'none';
    
    try {
      const formData = new FormData(form);
      const response = await fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        formStatus.textContent = 'Message sent successfully! I\'ll get back to you soon.';
        formStatus.className = 'form-status success';
        formStatus.style.display = 'block';
        form.reset();
        charCount.textContent = '0';
      } else {
        throw new Error('Form submission failed');
      }
    } catch (error) {
      formStatus.textContent = 'Sorry, there was an error sending your message. Please try again or contact me directly.';
      formStatus.className = 'form-status error';
      formStatus.style.display = 'block';
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });
  
  // Auto-resize textarea
  if (messageTextarea) {
    messageTextarea.addEventListener('input', () => {
      messageTextarea.style.height = 'auto';
      messageTextarea.style.height = messageTextarea.scrollHeight + 'px';
    });
  }
}

// ----------------- Project Demo Modals -----------------
function showProjectDemo(projectId) {
  const demos = {
    'climate-bot': {
      title: 'Climate-IoT LinkedIn Bot',
      content: `
        <div class="demo-content">
          <h4>How it works:</h4>
          <ol>
            <li>Fetches air quality data from satellite APIs</li>
            <li>Processes and analyzes pollution levels</li>
            <li>Generates informative posts with visualizations</li>
            <li>Automatically posts to LinkedIn weekly</li>
          </ol>
          <h4>Tech Stack:</h4>
          <ul>
            <li>Python for data processing</li>
            <li>LinkedIn API for posting</li>
            <li>Satellite data APIs for air quality</li>
            <li>APScheduler for automation</li>
          </ul>
          <p><strong>Impact:</strong> Making environmental data more accessible to the public.</p>
        </div>
      `
    },
    'property-mgmt': {
      title: 'Property Management System',
      content: `
        <div class="demo-content">
          <h4>Features:</h4>
          <ul>
            <li>Property listing and management</li>
            <li>Tenant information tracking</li>
            <li>Rent collection monitoring</li>
            <li>Admin dashboard with analytics</li>
          </ul>
          <h4>Demo Credentials:</h4>
          <p><strong>Username:</strong> admin@example.com<br>
          <strong>Password:</strong> Admin123!</p>
          <p><strong>Tech Stack:</strong> Web technologies, CRUD operations, responsive design</p>
        </div>
      `
    }
  };
  
  const demo = demos[projectId];
  if (!demo) return;
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'overlay';
  modal.innerHTML = `
    <div class="overlay__panel" role="dialog" aria-labelledby="demo-title" aria-modal="true">
      <div class="overlay__head">
        <h3 id="demo-title">${demo.title} - Demo Details</h3>
        <button class="icon-btn demo-close" aria-label="Close">×</button>
      </div>
      <div class="demo-body">
        ${demo.content}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.hidden = false;
  
  // Close handlers
  const closeBtn = modal.querySelector('.demo-close');
  const closeModal = () => {
    document.body.removeChild(modal);
  };
  
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// ----------------- Performance Optimizations -----------------
function initPerformanceOptimizations() {
  // Lazy load images
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src || img.src;
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    });
    
    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
      imageObserver.observe(img);
    });
  }
  
  // Preload critical resources
  const criticalResources = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
  ];
  
  criticalResources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource;
    link.as = 'style';
    document.head.appendChild(link);
  });
}

// ----------------- Analytics Integration -----------------
function initAnalytics() {
  // Google Analytics 4 (replace with your GA4 measurement ID)
  const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Replace with actual ID
  
  if (GA_MEASUREMENT_ID && GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX') {
    // Load GA4
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
    
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID);
    
    // Track social sharing
    document.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const platform = btn.classList.contains('linkedin') ? 'LinkedIn' :
                        btn.classList.contains('twitter') ? 'Twitter' :
                        btn.classList.contains('facebook') ? 'Facebook' : 'Copy URL';
        gtag('event', 'share', {
          method: platform,
          content_type: 'portfolio',
          item_id: 'jethro-kimande-portfolio'
        });
      });
    });
    
    // Track project interactions
    document.querySelectorAll('.project-card .btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const projectName = btn.closest('.project-card').querySelector('h3').textContent;
        gtag('event', 'project_interaction', {
          project_name: projectName,
          action: btn.textContent.trim()
        });
      });
    });
  }
}

// ----------------- Theme Toggle -----------------
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;
  
  // Get saved theme or default to system preference
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
  
  // Apply initial theme
  html.setAttribute('data-theme', initialTheme);
  updateThemeIcon(initialTheme);
  
  // Theme toggle functionality
  themeToggle?.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Add transition effect
    html.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      html.style.transition = '';
    }, 300);
  });
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      const newTheme = e.matches ? 'dark' : 'light';
      html.setAttribute('data-theme', newTheme);
      updateThemeIcon(newTheme);
    }
  });
}

function updateThemeIcon(theme) {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;
  
  const icon = themeToggle.querySelector('i');
  if (theme === 'dark') {
    icon.className = 'fas fa-sun';
    themeToggle.setAttribute('aria-label', 'Switch to light mode');
  } else {
    icon.className = 'fas fa-moon';
    themeToggle.setAttribute('aria-label', 'Switch to dark mode');
  }
}

// ----------------- Enhanced Mobile Navigation -----------------
function initMobileNavigation() {
  const navToggle = document.getElementById('nav-toggle');
  const nav = document.querySelector('.nav');
  const hamburger = document.querySelector('.hamburger');
  
  if (!navToggle || !nav || !hamburger) return;
  
  navToggle.addEventListener('change', () => {
    if (navToggle.checked) {
      nav.style.maxHeight = nav.scrollHeight + 'px';
      hamburger.style.transform = 'rotate(90deg)';
    } else {
      nav.style.maxHeight = '0';
      hamburger.style.transform = 'rotate(0deg)';
    }
  });
  
  // Close mobile nav when clicking on links
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.checked = false;
      nav.style.maxHeight = '0';
      hamburger.style.transform = 'rotate(0deg)';
    });
  });
  
  // Close mobile nav when clicking outside
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !hamburger.contains(e.target) && navToggle.checked) {
      navToggle.checked = false;
      nav.style.maxHeight = '0';
      hamburger.style.transform = 'rotate(0deg)';
    }
  });
}

// ----------------- Initialize Everything -----------------
document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initMobileNavigation();
  initContactForm();
  initPerformanceOptimizations();
  initAnalytics();
  
  // Add smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
  
  // Add scroll-to-top functionality
  const scrollToTopBtn = document.createElement('button');
  scrollToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
  scrollToTopBtn.className = 'scroll-to-top';
  scrollToTopBtn.setAttribute('aria-label', 'Scroll to top');
  scrollToTopBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: var(--link);
    color: white;
    border: none;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  document.body.appendChild(scrollToTopBtn);
  
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      scrollToTopBtn.style.opacity = '1';
    } else {
      scrollToTopBtn.style.opacity = '0';
    }
  });
  
  scrollToTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
});