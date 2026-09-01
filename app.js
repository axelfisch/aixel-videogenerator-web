// AiXel VideoGenerator — cockpit (V0.5 : Nouveau projet + Sources et inventaire)
// Vanilla JS, sans framework ni étape de build — état + rendu + persistance locale
// (localStorage pour les métadonnées, IndexedDB pour les fichiers eux-mêmes — voir db.js).
const BUILD = "V0.5 · 2026-09-01 (sources et inventaire)";
const STORAGE_KEY = "aixel-videogenerator:state";
const OLD_STORAGE_KEY = "aixel-videogenerator:bmw-bnc"; // clé V0, migrée si trouvée

const STEP_DEFS = [
  { id: "sources", name: "Sources" },
  { id: "audio", name: "Audio verrouillé" },
  { id: "carte", name: "Carte musicale" },
  { id: "brief", name: "Brief créatif" },
  { id: "bibles", name: "Bibles visuelles" },
  { id: "histoire", name: "Histoire & motifs" },
  { id: "storyboard", name: "Storyboard" },
  { id: "images", name: "Images tests" },
  { id: "animatique", name: "Animatique" },
  { id: "production", name: "Production" },
  { id: "montage", name: "Montage & paroles" },
  { id: "qualite", name: "Qualité & exports" },
];
const STAGE_LABEL = {
  sources: "PRÉPRODUCTION", audio: "PRÉPRODUCTION", carte: "PRÉPRODUCTION", brief: "PRÉPRODUCTION", bibles: "PRÉPRODUCTION",
  histoire: "CONCEPTION", storyboard: "CONCEPTION", images: "CONCEPTION", animatique: "CONCEPTION",
  production: "PRODUCTION", montage: "PRODUCTION",
  qualite: "LIVRAISON",
};

const CATEGORIES = {
  audio: { label: "Audio", icon: "♪" },
  image: { label: "Images", icon: "▧" },
  video: { label: "Vidéo", icon: "▶" },
  texte: { label: "Paroles & textes", icon: "✎" },
  logo: { label: "Logos", icon: "◆" },
  autre: { label: "Autres", icon: "•" },
};
const ROLE_OPTIONS = ["Source", "Référence", "Brouillon", "Livrable"];

const STRUCTURE = [
  { id: "intro", label: "Intro", tag: "Installation", start: 0, energy: 32, dur: 17 },
  { id: "c1", label: "Couplet 1", tag: "Confiance", start: 17, energy: 57, dur: 34 },
  { id: "refrain", label: "Refrain", tag: "Éclat", start: 51, energy: 91, dur: 27 },
  { id: "c2", label: "Couplet 2", tag: "Mouvement", start: 78, energy: 68, dur: 34 },
  { id: "pont", label: "Pont", tag: "Suspension", start: 112, energy: 46, dur: 25 },
  { id: "final", label: "Final", tag: "Libération", start: 137, energy: 90, dur: 50 },
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function slugify(s) {
  return (s || "projet").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "projet";
}
function fmtBytes(n) {
  if (n == null) return "";
  if (n < 1024) return n + " o";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " Ko";
  return (n / (1024 * 1024)).toFixed(1) + " Mo";
}
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
function fmtRelative(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}
function categoryOf(file) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return /logo/.test(name) ? "logo" : "image";
  if (/\.(txt|md|docx?|pdf|rtf)$/.test(name)) return "texte";
  return "autre";
}

function seededWave(n, seed) {
  let x = seed;
  const rand = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return (x % 1000) / 1000; };
  const bars = [];
  for (let i = 0; i < n; i++) {
    const base = 0.25 + 0.55 * Math.abs(Math.sin(i / 6));
    bars.push(Math.max(0.08, Math.min(1, base + (rand() - 0.5) * 0.3)));
  }
  return bars;
}
const WAVE = seededWave(120, 42);

function freshSteps(doneIds = [], activeId = "sources") {
  return STEP_DEFS.map((s) => ({ ...s, status: doneIds.includes(s.id) ? "done" : s.id === activeId ? "active" : "pending" }));
}

function newProjectRecord(name, artist) {
  const now = Date.now();
  return {
    id: slugify(name) + "-" + uid().slice(0, 4),
    name: name || "Nouveau projet",
    artist: artist || "",
    createdAt: now,
    updatedAt: now,
    steps: freshSteps([], "sources"),
    activeStepId: "sources",
    sources: [],
    sourcesLocked: false,
    audio: null,
    playedRatio: 0,
    structure: [],
    decision: { selected: null, locked: false, lockedAt: null },
    creditsAvoided: 0,
  };
}

function demoProjectRecord() {
  const now = Date.now();
  return {
    id: "bmw-bnc",
    name: "BMW / BNC — MAT",
    artist: "MAT",
    createdAt: now,
    updatedAt: now,
    steps: freshSteps(["sources", "audio", "bibles"], "carte"),
    activeStepId: "carte",
    sources: [
      { id: "src-1", name: "BMW_BNC.wav", size: 31_800_000, mime: "audio/wav", category: "audio", role: "Source", addedAt: now, demo: true },
      { id: "src-2", name: "paroles_bmw_bnc.txt", size: 3_100, mime: "text/plain", category: "texte", role: "Source", addedAt: now, demo: true },
      { id: "src-3", name: "MAT_Avatar_Character_Sheet_v1.png", size: 4_200_000, mime: "image/png", category: "image", role: "Référence", addedAt: now, demo: true },
      { id: "src-4", name: "logo_aixel_studio.svg", size: 18_000, mime: "image/svg+xml", category: "logo", role: "Référence", addedAt: now, demo: true },
    ],
    sourcesLocked: true,
    audio: { file: "BMW_BNC.wav", duration: 187.12, bpm: 117, peak: 3.1, profile: "Énergique" },
    playedRatio: 0.28,
    structure: STRUCTURE,
    decision: { selected: null, locked: false, lockedAt: null },
    creditsAvoided: 340,
  };
}

function defaultState() {
  const demo = demoProjectRecord();
  return { currentProjectId: demo.id, projects: { [demo.id]: demo }, ui: { projectMenuOpen: false, newProjectOpen: false, draftName: "", draftArtist: "" } };
}

let state = load();
const imageUrlCache = new Map(); // sourceId -> object URL, pour éviter de relire IndexedDB à chaque rendu

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, ui: { projectMenuOpen: false, newProjectOpen: false, draftName: "", draftArtist: "" } };
    }
    // Migration depuis la V0 (un seul projet BMW/BNC codé en dur)
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old) {
      const parsedOld = JSON.parse(old);
      const demo = { ...demoProjectRecord(), ...parsedOld, sources: demoProjectRecord().sources, sourcesLocked: true };
      return { currentProjectId: demo.id, projects: { [demo.id]: demo }, ui: { projectMenuOpen: false, newProjectOpen: false, draftName: "", draftArtist: "" } };
    }
    return defaultState();
  } catch {
    return defaultState();
  }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
function currentProject() {
  return state.projects[state.currentProjectId] || null;
}
function touch(project) { project.updatedAt = Date.now(); }

function progressPct(project) {
  const weight = project.steps.reduce((acc, s) => acc + (s.status === "done" ? 1 : s.status === "active" ? 0.5 : 0), 0);
  return Math.round((weight / project.steps.length) * 100);
}
function stepIcon(status) { return status === "done" ? "✓" : ""; }

// ---------------------------------------------------------------- rendu

function render() {
  const app = document.getElementById("app");
  if (!state.currentProjectId || !currentProject()) {
    app.innerHTML = renderLibrary();
    bindLibrary();
    return;
  }
  const project = currentProject();
  const step = project.steps.find((s) => s.id === project.activeStepId) || project.steps[0];
  app.innerHTML = `
    ${renderLeftRail(project)}
    <main class="main">${renderMain(project, step)}</main>
    ${renderRightRail(project)}
    ${state.ui.newProjectOpen ? renderNewProjectModal() : ""}
  `;
  bindCockpit(project);
  loadThumbnails(project);
}

// ---------- Bibliothèque de projets ----------

function renderLibrary() {
  const list = Object.values(state.projects).sort((a, b) => b.updatedAt - a.updatedAt);
  return `
    <div class="library">
      <div class="library-head">
        <div class="brand">
          <div class="mark">A</div>
          <div class="lines"><div class="studio">AIXEL STUDIO</div><div class="app-name">VideoGenerator</div></div>
        </div>
        <h1>Tes projets</h1>
        <p class="page-sub">Un atelier de réalisation de vidéoclips, pas un bouton "générer". Choisis un projet ou commences-en un nouveau.</p>
      </div>
      <div class="library-grid">
        <button class="project-card new-card" id="newProjectCard">
          <span class="plus">+</span>
          <b>Nouveau projet</b>
        </button>
        ${list.map((p) => `
          <button class="project-card" data-open="${p.id}">
            <div class="pc-top"><b>${escapeHtml(p.name)}</b><span class="pc-pct">${progressPct(p)}%</span></div>
            <div class="pc-artist">${escapeHtml(p.artist || "—")}</div>
            <div class="process-bar"><i style="width:${progressPct(p)}%"></i></div>
            <div class="pc-meta">${p.sources.length} source${p.sources.length > 1 ? "s" : ""} · mis à jour ${fmtRelative(p.updatedAt)}</div>
          </button>
        `).join("")}
      </div>
    </div>
    ${state.ui.newProjectOpen ? renderNewProjectModal() : ""}
  `;
}

function bindLibrary() {
  const nc = document.getElementById("newProjectCard");
  if (nc) nc.addEventListener("click", () => { state.ui.newProjectOpen = true; render(); });
  document.querySelectorAll("[data-open]").forEach((el) => {
    el.addEventListener("click", () => { state.currentProjectId = el.dataset.open; persist(); render(); });
  });
  bindNewProjectModal();
}

function renderNewProjectModal() {
  return `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal">
        <h2>Nouveau projet</h2>
        <label>Titre du projet<input type="text" id="npName" value="${escapeAttr(state.ui.draftName)}" placeholder="Ex. Souvenirs Country" autofocus /></label>
        <label>Artiste / auteur<input type="text" id="npArtist" value="${escapeAttr(state.ui.draftArtist)}" placeholder="Ex. Axel Fisch" /></label>
        <p class="modal-hint">Tu pourras importer tes sources (audio, images, paroles) juste après la création.</p>
        <div class="modal-actions">
          <button class="btn ghost" id="npCancel">Annuler</button>
          <button class="btn primary" id="npCreate">Créer le projet →</button>
        </div>
      </div>
    </div>
  `;
}
function bindNewProjectModal() {
  const backdrop = document.getElementById("modalBackdrop");
  if (!backdrop) return;
  const nameEl = document.getElementById("npName");
  const artistEl = document.getElementById("npArtist");
  nameEl.addEventListener("input", () => { state.ui.draftName = nameEl.value; });
  artistEl.addEventListener("input", () => { state.ui.draftArtist = artistEl.value; });
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  document.getElementById("npCancel").addEventListener("click", closeModal);
  document.getElementById("npCreate").addEventListener("click", () => {
    const name = nameEl.value.trim();
    if (!name) { nameEl.focus(); return; }
    const project = newProjectRecord(name, artistEl.value.trim());
    state.projects[project.id] = project;
    state.currentProjectId = project.id;
    closeModal(false);
    persist();
    render();
    toast("Projet créé — importe tes premières sources.");
  });
  function closeModal(doRender = true) {
    state.ui.newProjectOpen = false;
    state.ui.draftName = "";
    state.ui.draftArtist = "";
    if (doRender) render();
  }
}

// ---------- Cockpit (projet ouvert) ----------

function renderLeftRail(project) {
  const pct = progressPct(project);
  return `
    <aside class="left-rail">
      <div class="brand">
        <div class="mark">A</div>
        <div class="lines"><div class="studio">AIXEL STUDIO</div><div class="app-name">VideoGenerator</div></div>
        <span class="pilot-badge">${project.id === "bmw-bnc" ? "PILOTE · V0" : "V0.5"}</span>
      </div>

      <div class="project-select" id="projectSelect">
        <div class="label">PROJET ACTIF</div>
        <div class="name"><span>${escapeHtml(project.name)}</span><span>▾</span></div>
      </div>
      ${state.ui.projectMenuOpen ? renderProjectMenu() : ""}

      <div>
        <div class="process-head"><b>Processus AiXel</b><span class="process-pct">${pct}%</span></div>
        <div class="process-bar"><i style="width:${pct}%"></i></div>
        <div class="steps">
          ${project.steps.map((s) => `
            <div class="step ${s.status} ${s.id === project.activeStepId ? "active" : ""}" data-step="${s.id}">
              <span class="num">${stepIcon(s.status)}</span><span class="name">${s.name}</span>
            </div>`).join("")}
        </div>
      </div>

      <div class="credits-card">
        <div class="amt">≈ ${project.creditsAvoided}</div>
        <div class="lbl">crédits évités grâce aux validations en amont</div>
      </div>
    </aside>
  `;
}

function renderProjectMenu() {
  const list = Object.values(state.projects).sort((a, b) => b.updatedAt - a.updatedAt);
  return `
    <div class="project-menu">
      ${list.map((p) => `<button class="pm-item ${p.id === state.currentProjectId ? "current" : ""}" data-switch="${p.id}">${escapeHtml(p.name)}</button>`).join("")}
      <button class="pm-item pm-new" data-newproject="1">+ Nouveau projet</button>
      <button class="pm-item pm-home" data-home="1">🏠 Bibliothèque</button>
    </div>
  `;
}

function renderMain(project, step) {
  const crumb = `${project.name.toUpperCase()} / ${STAGE_LABEL[step.id] || ""}`;
  if (step.id === "sources") return `<div class="crumb">${crumb}</div>` + renderSourcesStep(project);
  if (step.id === "carte" && project.audio) return `<div class="crumb">${crumb}</div>` + renderCarteMusicale(project);
  return `<div class="crumb">${crumb}</div>` + renderPlaceholder(project, step);
}

function renderPlaceholder(project, step) {
  const audioSrc = project.sources.find((s) => s.category === "audio");
  let hint = "Cette étape sera construite dans une prochaine tranche (voir la feuille de route).";
  if (step.id === "audio" && audioSrc) {
    hint = `Fichier candidat détecté dans les sources : <b>${escapeHtml(audioSrc.name)}</b> (${fmtBytes(audioSrc.size)}). Le verrouillage réel de l'audio et son analyse locale arrivent à l'étape suivante.`;
  } else if (step.id === "audio") {
    hint = "Aucun fichier audio dans les sources pour l'instant — retourne à l'étape Sources pour en importer un.";
  }
  return `
    <div class="page-head"><h1>${step.name}</h1></div>
    <p class="page-sub">${hint}</p>
    <div class="card empty-card">
      <div class="empty-hint">🚧 ${escapeHtml(step.name)} — pas encore construit</div>
    </div>
  `;
}

// ---------- Étape Sources et inventaire ----------

function renderSourcesStep(project) {
  const groups = {};
  Object.keys(CATEGORIES).forEach((c) => (groups[c] = []));
  project.sources.forEach((s) => groups[s.category]?.push(s));
  const dupCount = project.sources.filter((s) => s.dup).length;

  return `
    <div class="page-head">
      <h1>Sources et inventaire</h1>
      <span class="status-chip ${project.sourcesLocked ? "" : "chip-pending"}">${project.sourcesLocked ? "Inventaire verrouillé" : `${project.sources.length} fichier${project.sources.length === 1 ? "" : "s"} importé${project.sources.length === 1 ? "" : "s"}`}</span>
    </div>
    <p class="page-sub">Rassemble tout ce dont ce clip a besoin : audio, paroles, images de référence, vidéos, logos. Rien n'est encore analysé ni généré — on classe seulement.</p>

    ${project.sourcesLocked ? `<div class="locked-banner">🔒 Inventaire verrouillé — ces sources deviennent la référence pour la suite.
      <button class="btn small reopen" id="reopenSources">Rouvrir</button></div>` : ""}

    ${project.sourcesLocked ? "" : `
    <div class="card dropzone" id="dropzone">
      <input type="file" id="fileInput" multiple hidden />
      <div class="dz-icon">⇪</div>
      <b>Glisse des fichiers ici, ou clique pour parcourir</b>
      <small>Audio, images, paroles (.txt/.pdf/.docx), vidéos, logos — tout reste local dans ton navigateur.</small>
    </div>`}

    ${dupCount > 0 ? `<div class="dup-banner">⚠ ${dupCount} doublon${dupCount > 1 ? "s" : ""} détecté${dupCount > 1 ? "s" : ""} (même nom et même taille qu'un fichier déjà importé).
      <button class="btn small" id="clearDups">Supprimer les doublons</button></div>` : ""}

    ${project.sources.length === 0 ? `<div class="card"><div class="empty-hint">Aucune source importée pour l'instant.</div></div>` : Object.entries(groups).filter(([, items]) => items.length).map(([cat, items]) => `
      <div class="card source-group">
        <h2>${CATEGORIES[cat].icon} ${CATEGORIES[cat].label} <span class="count">${items.length}</span></h2>
        <div class="source-list">
          ${items.map((s) => renderSourceRow(s, project)).join("")}
        </div>
      </div>
    `).join("")}

    ${project.sources.length > 0 && !project.sourcesLocked ? `
      <div class="card decision-card">
        <div class="decision-icon">✦</div>
        <div class="decision-body">
          <h3>Verrouiller l'inventaire</h3>
          <p>Une fois verrouillé, ces sources deviennent la référence officielle pour l'audio, les bibles visuelles et le storyboard. Tu pourras toujours rouvrir cette barrière plus tard.</p>
        </div>
        <div class="decision-actions">
          <button class="btn primary" id="lockSources">Verrouiller l'inventaire →</button>
        </div>
      </div>
    ` : ""}
  `;
}

function renderSourceRow(s, project) {
  const cat = s.category;
  const thumb = cat === "image" || cat === "logo"
    ? `<div class="src-thumb" data-thumb="${s.id}">${imageUrlCache.get(s.id) ? `<img src="${imageUrlCache.get(s.id)}" alt="" />` : ""}</div>`
    : `<div class="src-thumb icon">${CATEGORIES[cat].icon}</div>`;
  return `
    <div class="source-row">
      ${thumb}
      <div class="src-meta">
        <div class="src-name">${escapeHtml(s.name)} ${s.dup ? '<span class="dup-badge">doublon</span>' : ""}</div>
        <div class="src-sub">${fmtBytes(s.size)}${s.demo ? " · exemple" : ""}</div>
      </div>
      <select class="role-select" data-role="${s.id}" ${project.sourcesLocked ? "disabled" : ""}>
        ${ROLE_OPTIONS.map((r) => `<option value="${r}" ${r === s.role ? "selected" : ""}>${r}</option>`).join("")}
      </select>
      ${project.sourcesLocked ? "" : `<button class="src-del" data-del="${s.id}" aria-label="Retirer">✕</button>`}
    </div>
  `;
}

async function loadThumbnails(project) {
  const targets = document.querySelectorAll("[data-thumb]");
  for (const el of targets) {
    const id = el.dataset.thumb;
    if (imageUrlCache.has(id)) continue;
    try {
      const blob = await AiXelDB.getBlob(id);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      imageUrlCache.set(id, url);
      el.innerHTML = `<img src="${url}" alt="" />`;
    } catch {}
  }
}

// ---------- Étape Carte musicale (démo BMW/BNC, inchangée depuis V0) ----------

function renderCarteMusicale(project) {
  return `
    <div class="page-head">
      <h1>Carte musicale</h1>
      <span class="status-chip">Analyse locale terminée</span>
    </div>
    <p class="page-sub">La structure est analysée. Ta validation artistique décidera du rythme du storyboard.</p>

    ${project.decision.locked ? `<div class="locked-banner">🔒 Carte musicale verrouillée — cette étape sert désormais de référence pour le storyboard.
      <button class="btn small reopen" id="reopenBtn">Rouvrir</button></div>` : ""}

    <div class="card audio-card">
      <div class="row">
        <button class="play-btn" id="playBtn" aria-label="Lire">▶</button>
        <div class="audio-meta"><div class="fname">${project.audio.file}</div><div class="ftag">MASTER AUDIO · VERROUILLÉ</div></div>
        <div class="audio-time">${fmtTime(project.audio.duration * project.playedRatio)} / ${fmtTime(project.audio.duration)}</div>
      </div>
      <div class="waveform" id="waveform">
        ${WAVE.map((h, i) => `<i style="height:${Math.round(h * 100)}%" class="${i / WAVE.length < project.playedRatio ? "played" : ""}"></i>`).join("")}
      </div>
      <div class="metric-row">
        <div class="metric"><b>${project.audio.bpm}</b><small>BPM estimé</small></div>
        <div class="metric"><b>${fmtTime(project.audio.duration)}</b><small>durée</small></div>
        <div class="metric"><b>+${project.audio.peak.toFixed(1)} dB</b><small>crête</small></div>
        <div class="metric"><b style="font-size:14px">${project.audio.profile}</b><small>profil dominant</small></div>
      </div>
    </div>

    <div class="card">
      <div class="section-head"><h2>Structure proposée</h2><span class="count">${project.structure.length} sections · 24 plans recommandés</span></div>
      <div class="struct-grid">
        ${project.structure.map((s, i) => `
          <div class="struct-card ${s.id === "refrain" ? "current" : ""}">
            <div class="top"><span>0${i + 1}</span><span>${fmtTime(s.start)}</span></div>
            <div class="title">${s.label}</div><div class="sub">${s.tag}</div>
            <div class="energy-bar"><i style="width:${s.energy}%"></i></div>
            <div class="dur">${s.energy}% énergie · ${fmtTime(s.dur)}</div>
          </div>`).join("")}
      </div>
    </div>

    <div class="card decision-card">
      <div class="decision-icon">✦</div>
      <div class="decision-body">
        <h3>Décision artistique requise</h3>
        <p>Le refrain doit-il accélérer le montage ? L'analyse détecte un pic à 00:51. Je propose des plans de 2,8&nbsp;s, contre 4,6&nbsp;s dans le couplet.</p>
        <div class="decision-opts">
          <button class="opt-btn ${project.decision.selected === "accelerer" ? "selected" : ""}" data-opt="accelerer" ${project.decision.locked ? "disabled" : ""}><b>A · Accélérer</b><small>8 plans · impact fort</small></button>
          <button class="opt-btn ${project.decision.selected === "respirer" ? "selected" : ""}" data-opt="respirer" ${project.decision.locked ? "disabled" : ""}><b>B · Respirer</b><small>5 plans · plus cinématique</small></button>
        </div>
        ${project.decision.lockedAt ? `<div class="decision-log"><b>${project.decision.locked ? "Verrouillé" : "Modifié"}</b> par Axel Fisch — ${new Date(project.decision.lockedAt).toLocaleString("fr-CA")}</div>` : ""}
      </div>
      <div class="decision-actions">
        <button class="btn primary" id="lockBtn" ${project.decision.selected ? "" : "disabled"}>${project.decision.locked ? "Rouvrir la barrière" : "Valider la direction →"}</button>
      </div>
    </div>
  `;
}

function renderRightRail(project) {
  const score = progressPct(project);
  const isDemo = project.id === "bmw-bnc";
  return `
    <aside class="right-rail">
      <div class="score-card">
        <div class="score-ring" style="--pct:${score}"><b>${score}</b></div>
        <div class="stage">${STAGE_LABEL[project.activeStepId] === "PRÉPRODUCTION" ? "Préproduction" : (STAGE_LABEL[project.activeStepId] || "").toLowerCase()}</div>
        <div class="note">${score < 30 ? "Tout début du projet" : score < 70 ? "Solide, à sécuriser" : "Bien avancé"}</div>
      </div>

      <div class="rail-h">Alertes de continuité <span>${isDemo ? 3 : 0}</span></div>
      ${isDemo ? `
        <div class="alert priority"><span class="tag">Prioritaire</span><b>Véhicule non verrouillé dans 6 plans</b><p>Le modèle change entre Bentley, BMW et cabriolet générique.</p></div>
        <div class="alert warn"><span class="tag">À corriger</span><b>Générique final non conforme</b><p>Remplacer les faux crédits par le master AiXel Studio officiel.</p></div>
        <div class="alert ok"><span class="tag">Valide</span><b>Identité de MAT stable</b><p>Visage, lunettes, bomber et bijoux reconnus sur les références.</p></div>
      ` : `<div class="empty-hint">Pas encore d'alertes — importe des sources et avance dans les étapes pour activer les vérifications de continuité.</div>`}

      <div class="rail-h">Références verrouillées ${isDemo ? '<button class="link-btn">Tout voir</button>' : ""}</div>
      ${isDemo ? `
        <div class="ref-grid">
          <div class="ref-item first" style="background:linear-gradient(135deg,#1c2c46,#3fd6f5 140%)"><div class="cap">MAT · Canon v1</div></div>
          <div class="ref-item" style="background:linear-gradient(135deg,#2a1f3d,#f26fd0 160%)"><div class="cap">Neon Drive</div></div>
          <div class="ref-item" style="background:linear-gradient(135deg,#241d10,#e8b95c 160%)"><div class="cap">Logo AiXel</div></div>
        </div>
      ` : `<div class="empty-hint">Aucune référence verrouillée — les bibles visuelles arrivent après la carte musicale.</div>`}

      <button class="btn primary prep-btn" id="prepBtn" ${project.decision.locked ? "" : "disabled"}>Préparer l'animatique →</button>
    </aside>
  `;
}

// ---------------------------------------------------------------- interactions

function bindCockpit(project) {
  document.getElementById("projectSelect")?.addEventListener("click", () => { state.ui.projectMenuOpen = !state.ui.projectMenuOpen; render(); });
  document.querySelectorAll("[data-switch]").forEach((el) => el.addEventListener("click", () => { state.currentProjectId = el.dataset.switch; state.ui.projectMenuOpen = false; persist(); render(); }));
  document.querySelector("[data-newproject]")?.addEventListener("click", () => { state.ui.projectMenuOpen = false; state.ui.newProjectOpen = true; render(); });
  document.querySelector("[data-home]")?.addEventListener("click", () => { state.ui.projectMenuOpen = false; state.currentProjectId = null; persist(); render(); });

  document.querySelectorAll(".step").forEach((el) => el.addEventListener("click", () => {
    project.activeStepId = el.dataset.step; persist(); render();
  }));

  bindNewProjectModal();
  bindSourcesStep(project);

  // Carte musicale (démo)
  document.querySelectorAll(".opt-btn").forEach((btn) => btn.addEventListener("click", () => {
    if (project.decision.locked) return;
    const opt = btn.dataset.opt;
    project.decision.selected = project.decision.selected === opt ? null : opt;
    persist(); render();
  }));
  const lockBtn = document.getElementById("lockBtn");
  if (lockBtn) lockBtn.addEventListener("click", () => {
    if (project.decision.locked) {
      project.decision.locked = false; project.decision.lockedAt = Date.now();
    } else {
      if (!project.decision.selected) return;
      project.decision.locked = true; project.decision.lockedAt = Date.now();
      const step = project.steps.find((s) => s.id === "carte"); if (step) step.status = "done";
      const next = project.steps.find((s) => s.id === "brief"); if (next && next.status === "pending") next.status = "active";
      toast("Carte musicale verrouillée.");
    }
    touch(project); persist(); render();
  });
  document.getElementById("reopenBtn")?.addEventListener("click", () => {
    project.decision.locked = false;
    const step = project.steps.find((s) => s.id === "carte"); if (step) step.status = "active";
    const next = project.steps.find((s) => s.id === "brief"); if (next && next.status === "active") next.status = "pending";
    touch(project); persist(); render();
  });
  document.getElementById("prepBtn")?.addEventListener("click", () => {
    if (!project.decision.locked) return;
    toast("Animatique : module V2.5, pas encore branché dans cette tranche.");
  });
  document.getElementById("playBtn")?.addEventListener("click", () => toast("Lecture audio réelle : branchée à l'étape Audio verrouillé (V1)."));
}

function bindSourcesStep(project) {
  const dz = document.getElementById("dropzone");
  const input = document.getElementById("fileInput");
  if (dz && input) {
    dz.addEventListener("click", () => input.click());
    input.addEventListener("change", () => handleFiles(project, input.files));
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
    dz.addEventListener("drop", (e) => { if (e.dataTransfer?.files?.length) handleFiles(project, e.dataTransfer.files); });
  }
  document.querySelectorAll("[data-role]").forEach((sel) => sel.addEventListener("change", () => {
    const s = project.sources.find((x) => x.id === sel.dataset.role);
    if (s) { s.role = sel.value; touch(project); persist(); }
  }));
  document.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", async () => {
    const id = btn.dataset.del;
    project.sources = project.sources.filter((x) => x.id !== id);
    if (imageUrlCache.has(id)) { URL.revokeObjectURL(imageUrlCache.get(id)); imageUrlCache.delete(id); }
    try { await AiXelDB.deleteBlob(id); } catch {}
    touch(project); persist(); render();
  }));
  document.getElementById("clearDups")?.addEventListener("click", async () => {
    const toRemove = project.sources.filter((s) => s.dup);
    for (const s of toRemove) { try { await AiXelDB.deleteBlob(s.id); } catch {} if (imageUrlCache.has(s.id)) { URL.revokeObjectURL(imageUrlCache.get(s.id)); imageUrlCache.delete(s.id); } }
    project.sources = project.sources.filter((s) => !s.dup);
    touch(project); persist(); render();
    toast("Doublons supprimés.");
  });
  document.getElementById("lockSources")?.addEventListener("click", () => {
    if (!project.sources.length) return;
    project.sourcesLocked = true;
    const step = project.steps.find((s) => s.id === "sources"); if (step) step.status = "done";
    const next = project.steps.find((s) => s.id === "audio"); if (next && next.status === "pending") next.status = "active";
    touch(project); persist(); render();
    toast("Inventaire verrouillé — l'audio devient la prochaine étape.");
  });
  document.getElementById("reopenSources")?.addEventListener("click", () => {
    project.sourcesLocked = false;
    const step = project.steps.find((s) => s.id === "sources"); if (step) step.status = "active";
    const next = project.steps.find((s) => s.id === "audio"); if (next && next.status === "active") next.status = "pending";
    touch(project); persist(); render();
  });
}

async function handleFiles(project, fileList) {
  const files = Array.from(fileList);
  for (const file of files) {
    const category = categoryOf(file);
    const dup = project.sources.some((s) => s.name === file.name && s.size === file.size);
    const id = uid();
    project.sources.push({ id, name: file.name, size: file.size, mime: file.type, category, role: "Source", addedAt: Date.now(), dup });
    try { await AiXelDB.putBlob(id, file); } catch (err) { console.error("Échec du stockage local", err); }
  }
  touch(project); persist(); render();
  if (files.length) toast(`${files.length} fichier${files.length > 1 ? "s" : ""} importé${files.length > 1 ? "s" : ""}.`);
}

function toast(msg) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function escapeAttr(s) { return escapeHtml(s); }

render();
