// AiXel VideoGenerator — cockpit (V0.5 : Nouveau projet + Sources et inventaire)
// Vanilla JS, sans framework ni étape de build — état + rendu + persistance locale
// (localStorage pour les métadonnées, IndexedDB pour les fichiers eux-mêmes — voir db.js).
const BUILD = "V2 · 2026-09-02 (histoire, storyboard)";
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

// Les six directions créatives (Product Architecture 1.0, §4) — des grammaires de départ,
// pas des cases qui limitent la description libre.
const DIRECTIONS = [
  { id: "recit", name: "Récit cinématographique", desc: "Chanson racontée comme un court métrage — histoire, progression, personnages, continuité forte des lieux et actions." },
  { id: "performance", name: "Performance d'artiste", desc: "L'interprète au centre — présence, émotion, chant, jeu, caméra. Studio, concert ou décor conceptuel." },
  { id: "poesie", name: "Poésie symbolique", desc: "Un monde construit à partir de métaphores et de motifs — narration non littérale, associations visuelles." },
  { id: "visualmelody", name: "Visual Melody", desc: "Vidéo abstraite ou semi-abstraite réactive à l'audio — réutilise les six moteurs Visual Melody, faible coût." },
  { id: "paroles", name: "Paroles en mouvement", desc: "Les mots et leur rythme au premier plan — lisibilité, phrasé, typographie, accentuation." },
  { id: "hybride", name: "Hybride dirigé", desc: "Une approche différente par section musicale (ex. intro Visual Melody, couplet narratif, refrain performance)." },
];

// Le brief structuré (§5) — la description libre reste toujours visible à côté, jamais écrasée.
const BRIEF_FIELDS = [
  { key: "emotion", label: "Émotion recherchée", placeholder: "Ex. fierté ironique, euphorie nocturne…" },
  { key: "public", label: "Public visé", placeholder: "Ex. fans existants, communauté BMW, Montréal…" },
  { key: "monde", label: "Monde et époque", placeholder: "Ex. Montréal contemporain, nuit électrique…" },
  { key: "personnages", label: "Personnages", placeholder: "Ex. MAT, ses amis…" },
  { key: "action", label: "Action (ou absence d'action)", placeholder: "Ex. une virée nocturne, un cycle qui se répète…" },
  { key: "palette", label: "Palette", placeholder: "Ex. navy, bleu électrique, magenta, or…" },
  { key: "camera", label: "Mouvement de caméra", placeholder: "Ex. travellings avant en voiture, plans rapprochés…" },
  { key: "style", label: "Réalisme ou stylisation", placeholder: "Ex. semi-réaliste 3D, 70% réalisme / 30% expressif…" },
  { key: "motifs", label: "Motifs récurrents", placeholder: "Ex. la roue qui tourne, le cycle qui recommence…" },
  { key: "obligatoires", label: "Éléments obligatoires", placeholder: "Ex. logo AiXel Studio au générique…" },
  { key: "interdits", label: "Éléments interdits", placeholder: "Ex. logos automobiles visibles, image dangereuse…" },
  { key: "references", label: "Références artistiques", placeholder: "Ex. Léo Cool, clips de nuit néon…" },
  { key: "contraintes", label: "Contraintes de budget et de plateforme", placeholder: "Ex. YouTube 16:9 d'abord, coûts à surveiller…" },
];

// Bibles visuelles / Canon Library (§8.5) — fiches réutilisables : personnages, tenues, objets,
// véhicules, lieux, palettes, styles. Chaque propriété est obligatoire, préférée ou interdite.
const CANON_CATEGORIES = {
  personnage: "Personnage", tenue: "Tenue", objet: "Objet", vehicule: "Véhicule",
  lieu: "Lieu", palette: "Palette", style: "Style",
};

// Histoire (§8.6 Story Engine) — devine une approche par section pour la direction "Hybride dirigé"
// (l'exemple du document : intro Visual Melody, couplet narratif, refrain performance, pont poétique,
// final hybride). Une PROPOSITION locale, pas une génération IA — à corriger comme tout le reste.
function guessDirectionForSection(label, fallback) {
  const l = (label || "").toLowerCase();
  if (l.startsWith("intro")) return "visualmelody";
  if (l.startsWith("refrain")) return "performance";
  if (l.startsWith("pont")) return "poesie";
  if (l.startsWith("final")) return "recit";
  if (l.startsWith("couplet")) return "recit";
  return fallback;
}

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

function defaultBrief() {
  return {
    direction: null,
    description: "",
    fields: Object.fromEntries(BRIEF_FIELDS.map((f) => [f.key, ""])),
    locked: false,
    lockedAt: null,
  };
}
function tagsToText(arr) { return (arr || []).join(", "); }
function textToTags(s) { return (s || "").split(",").map((x) => x.trim()).filter(Boolean); }

function defaultStory() {
  return { arc: "", motifs: [], sectionApproach: [], locked: false, lockedAt: null };
}
function defaultStoryboard() {
  return { shots: [], locked: false, lockedAt: null };
}

// Propose un arc et une approche par section (§8.6) — à partir du brief et de la carte musicale
// déjà verrouillés. Reste éditable en tout point ; rien n'est jamais imposé.
function proposeStory(project) {
  const b = project.brief;
  const dirName = (DIRECTIONS.find((d) => d.id === b.direction) || {}).name || "";
  const sectionApproach = (project.structure || []).map((s) => ({
    sectionId: s.id,
    label: s.label,
    direction: b.direction === "hybride" ? guessDirectionForSection(s.label, "recit") : (b.direction || "recit"),
  }));
  const shortDesc = b.description.length > 140 ? b.description.slice(0, 140) + "…" : b.description;
  const arc = `Proposition à corriger — à partir de « ${shortDesc} », une progression en ${(project.structure || []).length || "quelques"} temps, direction ${dirName || "à choisir"}.`;
  return { arc, motifs: textToTags(b.fields.motifs), sectionApproach };
}

// Storyboard (§8.7 Storyboard Engine) — découpe chaque section en plans au rythme de son énergie
// (mêmes seuils que la logique éditoriale déjà utilisée dans la carte musicale démo : plans plus
// courts sur les passages énergiques). Une proposition de structure, pas de prompts finis.
function proposeShots(project) {
  const shots = [];
  (project.structure || []).forEach((s) => {
    const dur = s.dur != null ? s.dur : Math.max(0, (s.end ?? s.start) - s.start);
    const approach = (project.story.sectionApproach || []).find((a) => a.sectionId === s.id);
    const isHigh = (s.energy || 0) >= 65;
    const targetShotLength = isHigh ? 3 : 4.5;
    const count = Math.max(1, Math.round(dur / targetShotLength) || 1);
    const shotDur = dur / count;
    for (let i = 0; i < count; i++) {
      shots.push({
        id: uid(),
        sectionId: s.id,
        sectionLabel: s.label,
        start: s.start + i * shotDur,
        dur: shotDur,
        direction: approach ? approach.direction : (project.brief.direction || "recit"),
        action: "", decor: "", camera: "", emotion: "",
        references: [], prompt: "",
        status: "proposé",
      });
    }
  });
  return shots;
}

function groupShotsBySection(project) {
  const bySection = new Map();
  project.storyboard.shots.forEach((sh) => {
    if (!bySection.has(sh.sectionId)) bySection.set(sh.sectionId, []);
    bySection.get(sh.sectionId).push(sh);
  });
  return (project.structure || []).map((s) => [s.id, bySection.get(s.id) || []]).filter(([, shots]) => shots.length);
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
    audioLocked: false,
    playedRatio: 0,
    structure: [],
    decision: { selected: null, locked: false, lockedAt: null },
    brief: defaultBrief(),
    canon: [],
    canonLocked: false,
    story: defaultStory(),
    storyboard: defaultStoryboard(),
    creditsAvoided: 0,
  };
}

// Rétrocompatibilité : les projets créés avant V1.5/V2 (ex. sur le navigateur d'Axel) n'ont pas
// encore ces champs en mémoire locale — on les complète sans toucher au reste.
function migrateProject(p) {
  if (!p.brief) p.brief = defaultBrief();
  if (!p.canon) p.canon = [];
  if (p.canonLocked == null) p.canonLocked = false;
  if (!p.story) p.story = defaultStory();
  if (!p.storyboard) p.storyboard = defaultStoryboard();
  return p;
}

function demoProjectRecord() {
  const now = Date.now();
  return {
    id: "bmw-bnc",
    name: "BMW / BNC — MAT",
    artist: "MAT",
    createdAt: now,
    updatedAt: now,
    steps: freshSteps(["sources", "audio", "brief", "bibles"], "carte"),
    activeStepId: "carte",
    sources: [
      { id: "src-1", name: "BMW_BNC.wav", size: 31_800_000, mime: "audio/wav", category: "audio", role: "Source", addedAt: now, demo: true },
      { id: "src-2", name: "paroles_bmw_bnc.txt", size: 3_100, mime: "text/plain", category: "texte", role: "Source", addedAt: now, demo: true },
      { id: "src-3", name: "MAT_Avatar_Character_Sheet_v1.png", size: 4_200_000, mime: "image/png", category: "image", role: "Référence", addedAt: now, demo: true },
      { id: "src-4", name: "logo_aixel_studio.svg", size: 18_000, mime: "image/svg+xml", category: "logo", role: "Référence", addedAt: now, demo: true },
    ],
    sourcesLocked: true,
    audio: { sourceId: "src-1", file: "BMW_BNC.wav", duration: 187.12, bpm: 117, peak: 3.1, profile: "Énergique", waveform: null },
    audioLocked: true,
    playedRatio: 0.28,
    structure: STRUCTURE,
    decision: { selected: null, locked: false, lockedAt: null },
    brief: {
      direction: "hybride",
      description: "Une virée nocturne à Montréal : MAT roule, ses amis, une soirée qui coûte cher — mais il assume, avec le sourire. Le cycle (roue, transaction, verre, chanson) qui recommence, pas de morale, juste l'énergie et l'ironie tranquille.",
      fields: {
        ...Object.fromEntries(BRIEF_FIELDS.map((f) => [f.key, ""])),
        emotion: "fierté ironique, euphorie nocturne",
        public: "communauté AiXel Studio, amateurs de BMW, Montréal",
        monde: "Montréal contemporain, nuit électrique",
        personnages: "MAT et ses amis",
        action: "une virée nocturne qui referme le cycle sur lui-même",
        palette: "navy profond, bleu électrique, magenta, or discret",
        camera: "travellings avant en voiture, plans rapprochés sur les réflexions néon",
        style: "3D semi-réaliste, environ 70% réalisme / 30% animation expressive",
        motifs: "la roue qui tourne, le cercle de transaction bancaire, le rebord du verre",
        obligatoires: "générique AiXel Studio officiel au final",
        interdits: "logos automobiles ou bancaires visibles sur MAT, image dangereuse ou criminelle",
        references: "univers de Léo Cool, clips de nuit néon",
        contraintes: "YouTube 16:9 en priorité, coûts de génération à surveiller",
      },
      locked: true,
      lockedAt: now,
    },
    canon: [
      {
        id: "canon-mat", category: "personnage", name: "MAT", sourceId: "src-3",
        description: "24 ans, Montréal, origines suisses-brésiliennes. Détendu, confiant, humour lucide sur ses dépenses.",
        obligatoire: ["teint chaud", "cheveux bouclés foncés", "lunettes rectangulaires teintées", "moustache fine", "bouc léger", "blouson bombardier bleu marine", "montre dorée", "petite croix dorée"],
        prefere: ["demi-sourire calme", "mains dans les poches"],
        interdit: ["vieillir ou rajeunir le personnage", "devenir Léo Cool", "persona de course agressive", "costume formel", "anatomie de super-héros"],
        status: "verrouillé", createdAt: now,
      },
      {
        id: "canon-bmw", category: "vehicule", name: "BMW nocturne", sourceId: null,
        description: "Le véhicule au centre du clip — reflets de ville, roue comme motif rythmique récurrent.",
        obligatoire: ["cohérent d'un plan à l'autre"],
        prefere: ["reflets néon sur la carrosserie"],
        interdit: ["logo BMW visible en gros plan (image de marque, pas de placement produit)"],
        status: "verrouillé", createdAt: now,
      },
      {
        id: "canon-montreal", category: "lieu", name: "Montréal nocturne", sourceId: null,
        description: "Suggérée par l'atmosphère et la texture urbaine — pas besoin de repères touristiques dans chaque plan.",
        obligatoire: [], prefere: ["néons, humidité, reflets"], interdit: ["clichés touristiques répétés"],
        status: "approuvé", createdAt: now,
      },
      {
        id: "canon-palette", category: "palette", name: "Palette night-driving", sourceId: null,
        description: "La palette qui unifie tout le clip.",
        obligatoire: ["navy profond", "bleu électrique", "magenta"], prefere: ["or chaud discret"], interdit: [],
        status: "verrouillé", createdAt: now,
      },
    ],
    canonLocked: true,
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
      const merged = { ...defaultState(), ...parsed, ui: { projectMenuOpen: false, newProjectOpen: false, draftName: "", draftArtist: "" } };
      Object.values(merged.projects).forEach(migrateProject);
      return merged;
    }
    // Migration depuis la V0 (un seul projet BMW/BNC codé en dur)
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old) {
      const parsedOld = JSON.parse(old);
      const demo = migrateProject({ ...demoProjectRecord(), ...parsedOld, sources: demoProjectRecord().sources, sourcesLocked: true });
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
  stopAudioPlaybackIfStale(project);
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
        <span class="pilot-badge">${project.id === "bmw-bnc" ? "PILOTE · V0" : "V2"}</span>
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
  if (step.id === "audio") return `<div class="crumb">${crumb}</div>` + renderAudioStep(project);
  if (step.id === "carte" && project.audio) return `<div class="crumb">${crumb}</div>` + renderCarteMusicale(project);
  if (step.id === "brief") return `<div class="crumb">${crumb}</div>` + renderBriefStep(project);
  if (step.id === "bibles") return `<div class="crumb">${crumb}</div>` + renderBiblesStep(project);
  if (step.id === "histoire") return `<div class="crumb">${crumb}</div>` + renderHistoireStep(project);
  if (step.id === "storyboard") return `<div class="crumb">${crumb}</div>` + renderStoryboardStep(project);
  return `<div class="crumb">${crumb}</div>` + renderPlaceholder(project, step);
}

function renderPlaceholder(project, step) {
  return `
    <div class="page-head"><h1>${step.name}</h1></div>
    <p class="page-sub">Cette étape sera construite dans une prochaine tranche (voir la feuille de route).</p>
    <div class="card empty-card">
      <div class="empty-hint">🚧 ${escapeHtml(step.name)} — pas encore construit</div>
    </div>
  `;
}

// ---------- Étape Audio verrouillé (analyse locale réelle) ----------

function renderAudioStep(project) {
  const audioSrc = project.sources.find((s) => s.category === "audio");
  if (!audioSrc) {
    return `
      <div class="page-head"><h1>Audio verrouillé</h1></div>
      <p class="page-sub">Aucun fichier audio dans les sources pour l'instant.</p>
      <div class="card empty-card"><div class="empty-hint">Retourne à l'étape Sources pour importer un fichier audio.</div></div>
    `;
  }
  if (!project.audio) {
    return `
      <div class="page-head"><h1>Audio verrouillé</h1></div>
      <p class="page-sub">Fichier candidat détecté dans les sources : <b>${escapeHtml(audioSrc.name)}</b> (${fmtBytes(audioSrc.size)}). L'analyse tourne 100% localement dans ton navigateur (forme d'onde, énergie, BPM estimé, proposition de structure) — rien n'est envoyé nulle part.</p>
      <div class="card">
        <div class="analyze-cta">
          <div class="decision-icon">♪</div>
          <div>
            <b>Prêt à analyser ${escapeHtml(audioSrc.name)}</b>
            <p class="page-sub" style="margin:4px 0 0">Ça prend quelques secondes selon la taille du fichier.</p>
          </div>
          <button class="btn primary" id="analyzeBtn">Lancer l'analyse locale →</button>
        </div>
      </div>
    `;
  }
  const a = project.audio;
  return `
    <div class="page-head">
      <h1>Audio verrouillé</h1>
      <span class="status-chip ${project.audioLocked ? "" : "chip-pending"}">${project.audioLocked ? "Verrouillé" : "Analysé — à valider"}</span>
    </div>
    <p class="page-sub">Analyse locale réelle (Web Audio API), même méthode que dans AiXel Visual Melody.</p>
    ${project.audioLocked ? `<div class="locked-banner">🔒 Audio verrouillé — référence pour la carte musicale et la suite.
      <button class="btn small reopen" id="reopenAudio">Rouvrir</button></div>` : ""}
    <div class="card">
      <div class="metric-row">
        <div class="metric"><b>${Math.round(a.bpm)}</b><small>BPM estimé</small></div>
        <div class="metric"><b>${fmtTime(a.duration)}</b><small>durée</small></div>
        <div class="metric"><b>${(a.peak * 100).toFixed(0)}%</b><small>crête</small></div>
        <div class="metric"><b style="font-size:14px">${a.profile}</b><small>profil dominant</small></div>
      </div>
    </div>
    ${!project.audioLocked ? `
      <div class="card decision-card">
        <div class="decision-icon">✦</div>
        <div class="decision-body">
          <h3>Verrouiller l'audio</h3>
          <p>Cette analyse (BPM, énergie, structure proposée) devient la référence pour la carte musicale. Tu pourras la rouvrir et la relancer plus tard.</p>
        </div>
        <div class="decision-actions"><button class="btn primary" id="lockAudio">Verrouiller l'audio →</button></div>
      </div>
    ` : ""}
  `;
}

function profileFromEnergy(avg) {
  if (avg >= 0.6) return "Énergique";
  if (avg >= 0.35) return "Équilibré";
  return "Doux";
}

// ---------- Étape Brief créatif ----------

function renderBriefStep(project) {
  const b = project.brief;
  const locked = b.locked;
  return `
    <div class="page-head">
      <h1>Brief créatif</h1>
      <span class="status-chip ${locked ? "" : "chip-pending"}">${locked ? "Brief approuvé" : "À structurer"}</span>
    </div>
    <p class="page-sub">Choisis une direction créative, décris librement ton intention, puis précise les points clés. Ta description originale reste toujours visible — rien ne l'écrase jamais.</p>

    ${locked ? `<div class="locked-banner">🔒 Brief verrouillé — référence pour les bibles visuelles, l'histoire et le storyboard.
      <button class="btn small reopen" id="reopenBrief">Rouvrir</button></div>` : ""}

    <div class="card">
      <h2>Direction créative</h2>
      <div class="direction-grid">
        ${DIRECTIONS.map((d) => `
          <button class="direction-card ${b.direction === d.id ? "selected" : ""}" data-direction="${d.id}" ${locked ? "disabled" : ""}>
            <b>${d.name}</b>
            <p>${d.desc}</p>
          </button>
        `).join("")}
      </div>
    </div>

    <div class="card">
      <h2>Description libre</h2>
      <textarea id="briefDescription" class="brief-textarea" rows="5" placeholder="Décris ton intention avec tes mots — ambiance, histoire, ce que tu veux ressentir…" ${locked ? "disabled" : ""}>${escapeHtml(b.description)}</textarea>
    </div>

    <div class="card">
      <h2>Brief structuré</h2>
      <p class="page-sub" style="margin-top:-6px">Optionnel, mais aide l'histoire et le storyboard à rester cohérents avec ton intention.</p>
      <div class="field-grid">
        ${BRIEF_FIELDS.map((f) => `
          <label class="field">
            <span>${f.label}</span>
            <input type="text" data-field="${f.key}" value="${escapeAttr(b.fields[f.key] || "")}" placeholder="${escapeAttr(f.placeholder)}" ${locked ? "disabled" : ""} />
          </label>
        `).join("")}
      </div>
    </div>

    ${!locked ? `
      <div class="card decision-card">
        <div class="decision-icon">✦</div>
        <div class="decision-body">
          <h3>Verrouiller le brief</h3>
          <p>Une direction et une description sont nécessaires. Cette intention devient la référence pour les bibles visuelles, l'histoire et le storyboard.</p>
        </div>
        <div class="decision-actions">
          <button class="btn primary" id="lockBrief" ${b.direction && b.description.trim() ? "" : "disabled"}>Verrouiller le brief →</button>
        </div>
      </div>
    ` : ""}
  `;
}

// ---------- Étape Bibles visuelles (Canon Library) ----------

function renderBiblesStep(project) {
  const locked = project.canonLocked;
  const briefReady = project.brief && project.brief.locked;
  return `
    <div class="page-head">
      <h1>Bibles visuelles</h1>
      <span class="status-chip ${locked ? "" : "chip-pending"}">${locked ? "Bibles verrouillées" : `${project.canon.length} référence${project.canon.length === 1 ? "" : "s"}`}</span>
    </div>
    <p class="page-sub">Fiches canoniques pour personnages, tenues, véhicules, lieux, palettes et styles — réutilisables dans ce projet et les suivants. Chaque propriété peut être obligatoire, préférée ou interdite.</p>
    ${!briefReady && !locked ? `<div class="dup-banner">ℹ️ Le brief créatif n'est pas encore verrouillé — tu peux commencer les bibles, mais elles seront plus solides une fois l'intention fixée.</div>` : ""}

    ${locked ? `<div class="locked-banner">🔒 Bibles visuelles verrouillées — référence obligatoire pour le storyboard et le contrôle de continuité.
      <button class="btn small reopen" id="reopenBibles">Rouvrir</button></div>` : ""}

    ${!locked ? `<button class="btn ghost" id="addCanon" style="margin-bottom:14px">+ Nouvelle référence</button>` : ""}

    ${project.canon.length === 0 ? `<div class="card"><div class="empty-hint">Aucune référence pour l'instant — personnages, véhicules, lieux, palettes…</div></div>` : `
      <div class="canon-grid">
        ${project.canon.map((c) => renderCanonCard(c, project, locked)).join("")}
      </div>
    `}

    ${!locked && project.canon.length > 0 ? `
      <div class="card decision-card">
        <div class="decision-icon">✦</div>
        <div class="decision-body">
          <h3>Verrouiller les bibles</h3>
          <p>Ces références deviennent obligatoires pour le storyboard, les images tests et le contrôle de continuité.</p>
        </div>
        <div class="decision-actions"><button class="btn primary" id="lockBibles">Verrouiller les bibles →</button></div>
      </div>
    ` : ""}
  `;
}

function renderCanonCard(c, project, locked) {
  const imgSources = project.sources.filter((s) => s.category === "image" || s.category === "logo");
  return `
    <div class="card canon-card">
      <div class="canon-top">
        <select class="canon-category" data-canoncat="${c.id}" ${locked ? "disabled" : ""}>
          ${Object.entries(CANON_CATEGORIES).map(([k, v]) => `<option value="${k}" ${k === c.category ? "selected" : ""}>${v}</option>`).join("")}
        </select>
        <span class="status-chip small ${c.status === "verrouillé" ? "" : "chip-pending"}">${c.status}</span>
        ${!locked ? `<button class="src-del" data-delcanon="${c.id}" aria-label="Retirer" style="margin-left:auto">✕</button>` : ""}
      </div>
      <input class="canon-name" data-canonname="${c.id}" value="${escapeAttr(c.name)}" placeholder="Nom (ex. MAT, BMW nocturne…)" ${locked ? "disabled" : ""} />
      <textarea class="canon-desc" data-canondesc="${c.id}" rows="2" placeholder="Description courte…" ${locked ? "disabled" : ""}>${escapeHtml(c.description)}</textarea>
      ${imgSources.length ? `
        <label class="field"><span>Image de référence</span>
          <select data-canonsrc="${c.id}" ${locked ? "disabled" : ""}>
            <option value="">—</option>
            ${imgSources.map((s) => `<option value="${s.id}" ${s.id === c.sourceId ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
          </select>
        </label>
      ` : ""}
      <label class="field"><span>Obligatoire</span><input type="text" data-canonoblig="${c.id}" value="${escapeAttr(tagsToText(c.obligatoire))}" placeholder="séparés par des virgules" ${locked ? "disabled" : ""} /></label>
      <label class="field"><span>Préféré</span><input type="text" data-canonpref="${c.id}" value="${escapeAttr(tagsToText(c.prefere))}" placeholder="séparés par des virgules" ${locked ? "disabled" : ""} /></label>
      <label class="field"><span>Interdit</span><input type="text" data-canoninterdit="${c.id}" value="${escapeAttr(tagsToText(c.interdit))}" placeholder="séparés par des virgules" ${locked ? "disabled" : ""} /></label>
      ${!locked ? `
        <label class="field"><span>État</span>
          <select data-canonstatus="${c.id}">
            <option value="proposé" ${c.status === "proposé" ? "selected" : ""}>Proposé</option>
            <option value="approuvé" ${c.status === "approuvé" ? "selected" : ""}>Approuvé</option>
            <option value="verrouillé" ${c.status === "verrouillé" ? "selected" : ""}>Verrouillé</option>
          </select>
        </label>
      ` : ""}
    </div>
  `;
}

// ---------- Étape Histoire & motifs (Story Engine) ----------

function renderHistoireStep(project) {
  const st = project.story;
  const locked = st.locked;
  const hasStructure = (project.structure || []).length > 0;
  const proposed = st.arc.trim().length > 0 || st.sectionApproach.length > 0;

  return `
    <div class="page-head">
      <h1>Histoire & motifs</h1>
      <span class="status-chip ${locked ? "" : "chip-pending"}">${locked ? "Direction narrative verrouillée" : proposed ? "Proposition à corriger" : "À proposer"}</span>
    </div>
    <p class="page-sub">À partir du brief et de la carte musicale, une proposition d'arc et de motifs — à corriger, jamais à accepter les yeux fermés.</p>
    ${!project.brief.locked ? `<div class="dup-banner">ℹ️ Le brief créatif n'est pas encore verrouillé — la proposition sera plus solide une fois l'intention fixée.</div>` : ""}
    ${!hasStructure ? `<div class="dup-banner">ℹ️ Aucune carte musicale pour l'instant — verrouille l'audio et la carte musicale pour une proposition par section.</div>` : ""}

    ${locked ? `<div class="locked-banner">🔒 Histoire verrouillée — référence pour le storyboard.
      <button class="btn small reopen" id="reopenStory">Rouvrir</button></div>` : ""}

    ${!proposed ? `
      <div class="card">
        <div class="analyze-cta">
          <div class="decision-icon">✎</div>
          <div><b>Proposer une histoire</b><p class="page-sub" style="margin:4px 0 0">Basé sur ta direction créative, ta description et les sections de la carte musicale.</p></div>
          <button class="btn primary" id="proposeStoryBtn">Proposer une histoire →</button>
        </div>
      </div>
    ` : `
      <div class="card">
        <h2>Arc narratif <span style="font-weight:400;color:var(--faint);font-size:11px">— proposition, à réécrire librement</span></h2>
        <textarea id="storyArc" class="brief-textarea" rows="4" ${locked ? "disabled" : ""}>${escapeHtml(st.arc)}</textarea>
      </div>
      <div class="card">
        <h2>Motifs récurrents</h2>
        <input type="text" id="storyMotifs" class="canon-name" value="${escapeAttr(tagsToText(st.motifs))}" placeholder="séparés par des virgules" ${locked ? "disabled" : ""} />
      </div>
      ${hasStructure ? `
      <div class="card">
        <div class="section-head"><h2>Approche par section</h2><span class="count">${st.sectionApproach.length} section${st.sectionApproach.length > 1 ? "s" : ""}</span></div>
        <div class="field-grid">
          ${st.sectionApproach.map((a) => `
            <label class="field"><span>${escapeHtml(a.label)}</span>
              <select data-approach="${a.sectionId}" ${locked ? "disabled" : ""}>
                ${DIRECTIONS.map((d) => `<option value="${d.id}" ${d.id === a.direction ? "selected" : ""}>${d.name}</option>`).join("")}
              </select>
            </label>
          `).join("")}
        </div>
      </div>
      ` : ""}
      ${!locked ? `<button class="btn ghost" id="reproposeStory" style="margin-bottom:14px">↺ Refaire la proposition</button>` : ""}
    `}

    ${proposed && !locked ? `
      <div class="card decision-card">
        <div class="decision-icon">✦</div>
        <div class="decision-body">
          <h3>Verrouiller l'histoire</h3>
          <p>Cette direction narrative devient la référence pour le storyboard.</p>
        </div>
        <div class="decision-actions"><button class="btn primary" id="lockStory" ${st.arc.trim() ? "" : "disabled"}>Verrouiller l'histoire →</button></div>
      </div>
    ` : ""}
  `;
}

// ---------- Étape Storyboard (Storyboard Engine) ----------

function renderStoryboardStep(project) {
  const sb = project.storyboard;
  const locked = sb.locked;
  const hasStructure = (project.structure || []).length > 0;

  if (!hasStructure) {
    return `
      <div class="page-head"><h1>Storyboard</h1></div>
      <p class="page-sub">Aucune carte musicale pour l'instant.</p>
      <div class="card empty-card"><div class="empty-hint">Verrouille l'audio et la carte musicale pour générer un storyboard minuté.</div></div>
    `;
  }

  return `
    <div class="page-head">
      <h1>Storyboard</h1>
      <span class="status-chip ${locked ? "" : "chip-pending"}">${locked ? "Storyboard verrouillé" : sb.shots.length ? `${sb.shots.length} plans proposés` : "À générer"}</span>
    </div>
    <p class="page-sub">Plans minutés par section musicale — action, décor, caméra, émotion et références à préciser. Le coût réel arrivera avec les connecteurs de génération (V3) ; pour l'instant, seule la structure est proposée.</p>
    ${!project.canonLocked ? `<div class="dup-banner">ℹ️ Les bibles visuelles ne sont pas encore verrouillées — les références par plan seront disponibles une fois qu'elles le seront.</div>` : ""}

    ${locked ? `<div class="locked-banner">🔒 Storyboard verrouillé — référence pour l'animatique et la production.
      <button class="btn small reopen" id="reopenStoryboard">Rouvrir</button></div>` : ""}

    ${sb.shots.length === 0 ? `
      <div class="card">
        <div class="analyze-cta">
          <div class="decision-icon">▤</div>
          <div><b>Générer une proposition de plans</b><p class="page-sub" style="margin:4px 0 0">Découpe chaque section en plans, au rythme de son énergie.</p></div>
          <button class="btn primary" id="generateShotsBtn">Générer les plans →</button>
        </div>
      </div>
    ` : `
      ${!locked ? `<button class="btn ghost" id="regenShots" style="margin-bottom:14px">↺ Régénérer les plans</button>` : ""}
      ${groupShotsBySection(project).map(([, shots]) => `
        <div class="card">
          <div class="section-head"><h2>${escapeHtml(shots[0].sectionLabel)}</h2><span class="count">${shots.length} plan${shots.length > 1 ? "s" : ""}</span></div>
          <div class="shot-list">
            ${shots.map((sh, i) => renderShotRow(sh, i, project, locked)).join("")}
          </div>
        </div>
      `).join("")}
    `}

    ${sb.shots.length > 0 && !locked ? `
      <div class="card decision-card">
        <div class="decision-icon">✦</div>
        <div class="decision-body">
          <h3>Verrouiller le storyboard</h3>
          <p>Ces plans deviennent la référence pour l'animatique et la production.</p>
        </div>
        <div class="decision-actions"><button class="btn primary" id="lockStoryboard">Verrouiller le storyboard →</button></div>
      </div>
    ` : ""}
  `;
}

function renderShotRow(sh, i, project, locked) {
  const canonOptions = project.canon.filter((c) => c.status === "verrouillé");
  return `
    <div class="shot-row">
      <div class="shot-top">
        <span>0${i + 1}</span><span>${fmtTime(sh.start)} · ${sh.dur.toFixed(1)}s</span>
        <select class="canon-category" data-shotdir="${sh.id}" ${locked ? "disabled" : ""}>
          ${DIRECTIONS.map((d) => `<option value="${d.id}" ${d.id === sh.direction ? "selected" : ""}>${d.name}</option>`).join("")}
        </select>
      </div>
      <div class="field-grid">
        <label class="field"><span>Action</span><input type="text" data-shotaction="${sh.id}" value="${escapeAttr(sh.action)}" ${locked ? "disabled" : ""} /></label>
        <label class="field"><span>Décor</span><input type="text" data-shotdecor="${sh.id}" value="${escapeAttr(sh.decor)}" ${locked ? "disabled" : ""} /></label>
        <label class="field"><span>Caméra</span><input type="text" data-shotcamera="${sh.id}" value="${escapeAttr(sh.camera)}" ${locked ? "disabled" : ""} /></label>
        <label class="field"><span>Émotion</span><input type="text" data-shotemotion="${sh.id}" value="${escapeAttr(sh.emotion)}" ${locked ? "disabled" : ""} /></label>
      </div>
      ${canonOptions.length ? `
        <label class="field"><span>Références (bibles verrouillées)</span>
          <select multiple data-shotrefs="${sh.id}" ${locked ? "disabled" : ""} style="min-height:64px">
            ${canonOptions.map((c) => `<option value="${c.id}" ${sh.references.includes(c.id) ? "selected" : ""}>${escapeHtml(c.name || CANON_CATEGORIES[c.category])}</option>`).join("")}
          </select>
        </label>
      ` : ""}
      <label class="field"><span>Prompt structuré (brouillon)</span><textarea data-shotprompt="${sh.id}" rows="2" ${locked ? "disabled" : ""}>${escapeHtml(sh.prompt)}</textarea></label>
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
  const isDemo = project.id === "bmw-bnc";
  const wave = project.audio.waveform && project.audio.waveform.length ? project.audio.waveform : WAVE;
  const structure = project.structure.map((s) => ({
    ...s,
    dur: s.dur != null ? s.dur : Math.max(0, (s.end ?? s.start) - s.start),
    tag: s.tag != null ? s.tag : "",
  }));
  const refrainSection = structure.find((s) => /^Refrain/.test(s.label || ""));

  return `
    <div class="page-head">
      <h1>Carte musicale</h1>
      <span class="status-chip">${isDemo ? "Analyse locale terminée" : "Structure proposée — à corriger"}</span>
    </div>
    <p class="page-sub">${isDemo ? "La structure est analysée." : "Sections proposées automatiquement à partir des niveaux d'énergie — pas d'une vraie analyse de structure musicale (accords, mesures). Renomme-les librement."} Ta validation artistique décidera du rythme du storyboard.</p>

    ${project.decision.locked ? `<div class="locked-banner">🔒 Carte musicale verrouillée — cette étape sert désormais de référence pour le storyboard.
      <button class="btn small reopen" id="reopenBtn">Rouvrir</button></div>` : ""}

    <div class="card audio-card">
      <div class="row">
        <button class="play-btn" id="playBtn" aria-label="Lire">▶</button>
        <div class="audio-meta"><div class="fname">${escapeHtml(project.audio.file)}</div><div class="ftag">MASTER AUDIO · VERROUILLÉ</div></div>
        <div class="audio-time" id="audioTimeLabel">${fmtTime(0)} / ${fmtTime(project.audio.duration)}</div>
      </div>
      <div class="waveform" id="waveform">
        ${wave.map((h) => `<i style="height:${Math.max(8, Math.round(h * 100))}%"></i>`).join("")}
      </div>
      <div class="metric-row">
        <div class="metric"><b>${Math.round(project.audio.bpm)}</b><small>BPM estimé</small></div>
        <div class="metric"><b>${fmtTime(project.audio.duration)}</b><small>durée</small></div>
        <div class="metric"><b>${isDemo ? "+" + project.audio.peak.toFixed(1) + " dB" : (project.audio.peak * 100).toFixed(0) + "%"}</b><small>crête</small></div>
        <div class="metric"><b style="font-size:14px">${project.audio.profile}</b><small>profil dominant</small></div>
      </div>
    </div>

    <div class="card">
      <div class="section-head"><h2>Structure proposée</h2><span class="count">${structure.length} section${structure.length > 1 ? "s" : ""}${isDemo ? " · 24 plans recommandés" : ""}</span></div>
      <div class="struct-grid">
        ${structure.map((s, i) => `
          <div class="struct-card ${refrainSection && s.id === refrainSection.id ? "current" : ""}">
            <div class="top"><span>0${i + 1}</span><span>${fmtTime(s.start)}</span></div>
            ${isDemo ? `<div class="title">${escapeHtml(s.label)}</div>` : `<input class="title-input" data-section="${s.id}" value="${escapeAttr(s.label)}" />`}
            <div class="sub">${escapeHtml(s.tag)}</div>
            <div class="energy-bar"><i style="width:${s.energy}%"></i></div>
            <div class="dur">${s.energy}% énergie · ${fmtTime(s.dur)}</div>
          </div>`).join("")}
      </div>
    </div>

    ${refrainSection ? `
    <div class="card decision-card">
      <div class="decision-icon">✦</div>
      <div class="decision-body">
        <h3>Décision artistique requise</h3>
        <p>${escapeHtml(refrainSection.label)} doit-il accélérer le montage ? L'analyse détecte un pic à ${fmtTime(refrainSection.start)}. Je propose des plans de 2,8&nbsp;s, contre 4,6&nbsp;s dans un couplet.</p>
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
    ` : ""}
  `;
}

// ---------- Lecture audio réelle (élément persistant hors du DOM re-rendu) ----------
let audioEl = null;
let audioElKey = null;

function audioKeyFor(project) {
  return project.audio && project.audio.sourceId ? `${project.id}:${project.audio.sourceId}` : null;
}

function stopAudioPlaybackIfStale(project) {
  const key = project ? audioKeyFor(project) : null;
  const wantsCarte = project && project.activeStepId === "carte" && project.audio;
  if (audioEl && (!wantsCarte || audioElKey !== key)) audioEl.pause();
}

async function loadAudioEl(project) {
  const key = audioKeyFor(project);
  if (!key) return null;
  if (audioEl && audioElKey === key) return audioEl;
  if (audioEl) { audioEl.pause(); audioEl.remove(); }
  const blob = await AiXelDB.getBlob(project.audio.sourceId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  const el = document.createElement("audio");
  el.src = url;
  el.preload = "metadata";
  el.style.display = "none";
  document.body.appendChild(el);
  el.addEventListener("timeupdate", () => syncAudioUI());
  el.addEventListener("play", () => syncAudioUI());
  el.addEventListener("pause", () => syncAudioUI());
  el.addEventListener("ended", () => syncAudioUI());
  audioEl = el;
  audioElKey = key;
  return el;
}

function syncAudioUI() {
  if (!audioEl) return;
  const timeLabel = document.getElementById("audioTimeLabel");
  const playBtn = document.getElementById("playBtn");
  const wf = document.getElementById("waveform");
  if (timeLabel) timeLabel.textContent = `${fmtTime(audioEl.currentTime || 0)} / ${fmtTime(audioEl.duration || 0)}`;
  if (playBtn) playBtn.textContent = audioEl.paused ? "▶" : "⏸";
  if (wf && audioEl.duration) {
    const ratio = audioEl.currentTime / audioEl.duration;
    const bars = wf.children;
    const cut = Math.floor(ratio * bars.length);
    for (let i = 0; i < bars.length; i++) bars[i].classList.toggle("played", i < cut);
  }
}

function bindCarteMusicaleAudio(project) {
  const playBtn = document.getElementById("playBtn");
  const wf = document.getElementById("waveform");
  if (playBtn) playBtn.addEventListener("click", async () => {
    playBtn.disabled = true;
    try {
      const el = await loadAudioEl(project);
      if (!el) { toast("Fichier audio introuvable localement."); return; }
      if (el.paused) await el.play(); else el.pause();
    } catch { toast("Lecture impossible."); }
    playBtn.disabled = false;
  });
  if (wf) wf.addEventListener("click", async (e) => {
    const rect = wf.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const el = await loadAudioEl(project);
    if (!el) return;
    const setTime = () => { el.currentTime = ratio * (el.duration || project.audio.duration); syncAudioUI(); };
    if (el.readyState >= 1) setTime(); else el.addEventListener("loadedmetadata", setTime, { once: true });
  });
  document.querySelectorAll(".title-input").forEach((input) => {
    input.addEventListener("change", () => {
      const s = project.structure.find((x) => x.id === input.dataset.section);
      if (s) { s.label = input.value.trim() || s.label; touch(project); persist(); }
    });
  });
}

const CANON_GRADIENTS = {
  personnage: "linear-gradient(135deg,#1c2c46,#3fd6f5 140%)",
  tenue: "linear-gradient(135deg,#1c2c46,#3fd6f5 140%)",
  vehicule: "linear-gradient(135deg,#2a1f3d,#f26fd0 160%)",
  objet: "linear-gradient(135deg,#2a1f3d,#f26fd0 160%)",
  lieu: "linear-gradient(135deg,#122436,#3fd6f5 150%)",
  palette: "linear-gradient(135deg,#241d10,#e8b95c 160%)",
  style: "linear-gradient(135deg,#241d10,#e8b95c 160%)",
};

// Réel pour tout projet non-démo : les références de la bible verrouillées y apparaissent
// dès qu'il y en a, plutôt que le hardcodé du pilote BMW/BNC.
function renderLockedRefs(project, isDemo) {
  if (isDemo) {
    return `
      <div class="rail-h">Références verrouillées <button class="link-btn">Tout voir</button></div>
      <div class="ref-grid">
        <div class="ref-item first" style="background:linear-gradient(135deg,#1c2c46,#3fd6f5 140%)"><div class="cap">MAT · Canon v1</div></div>
        <div class="ref-item" style="background:linear-gradient(135deg,#2a1f3d,#f26fd0 160%)"><div class="cap">Neon Drive</div></div>
        <div class="ref-item" style="background:linear-gradient(135deg,#241d10,#e8b95c 160%)"><div class="cap">Logo AiXel</div></div>
      </div>
    `;
  }
  const locked = project.canon.filter((c) => c.status === "verrouillé");
  return `
    <div class="rail-h">Références verrouillées</div>
    ${locked.length ? `
      <div class="ref-grid">
        ${locked.slice(0, 6).map((c, i) => `
          <div class="ref-item ${i === 0 ? "first" : ""}" style="background:${CANON_GRADIENTS[c.category] || CANON_GRADIENTS.style}"><div class="cap">${escapeHtml(c.name || CANON_CATEGORIES[c.category])}</div></div>
        `).join("")}
      </div>
    ` : `<div class="empty-hint">Aucune référence verrouillée — les bibles visuelles arrivent après la carte musicale.</div>`}
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

      ${renderLockedRefs(project, isDemo)}

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
  bindAudioStep(project);
  bindBriefStep(project);
  bindBiblesStep(project);
  bindHistoireStep(project);
  bindStoryboardStep(project);

  if (project.activeStepId === "carte" && project.audio) {
    bindCarteMusicaleAudio(project);
    syncAudioUI();
  }

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
      if (next) project.activeStepId = next.id;
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
    if (next) project.activeStepId = next.id;
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

function bindAudioStep(project) {
  const analyzeBtn = document.getElementById("analyzeBtn");
  if (analyzeBtn) analyzeBtn.addEventListener("click", async () => {
    const audioSrc = project.sources.find((s) => s.category === "audio");
    if (!audioSrc) return;
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyse en cours…";
    try {
      const blob = await AiXelDB.getBlob(audioSrc.id);
      if (!blob) throw new Error("Fichier introuvable localement.");
      const result = await AiXelAudio.analyze(blob);
      project.audio = {
        sourceId: audioSrc.id,
        file: audioSrc.name,
        duration: result.duration,
        bpm: result.bpm,
        peak: result.peak,
        profile: profileFromEnergy(result.averageEnergy),
        waveform: result.waveform,
      };
      project.structure = result.sections;
      touch(project); persist(); render();
      toast("Analyse terminée.");
    } catch (err) {
      console.error(err);
      toast(err.message || "Échec de l'analyse audio.");
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "Lancer l'analyse locale →";
    }
  });
  document.getElementById("lockAudio")?.addEventListener("click", () => {
    project.audioLocked = true;
    const step = project.steps.find((s) => s.id === "audio"); if (step) step.status = "done";
    const next = project.steps.find((s) => s.id === "carte"); if (next && next.status === "pending") next.status = "active";
    if (next) project.activeStepId = next.id;
    touch(project); persist(); render();
    toast("Audio verrouillé.");
  });
  document.getElementById("reopenAudio")?.addEventListener("click", () => {
    project.audioLocked = false;
    const step = project.steps.find((s) => s.id === "audio"); if (step) step.status = "active";
    const next = project.steps.find((s) => s.id === "carte"); if (next && next.status === "active") next.status = "pending";
    touch(project); persist(); render();
  });
}

function bindBriefStep(project) {
  const b = project.brief;
  document.querySelectorAll("[data-direction]").forEach((btn) => btn.addEventListener("click", () => {
    if (b.locked) return;
    b.direction = btn.dataset.direction;
    touch(project); persist(); render();
  }));
  const desc = document.getElementById("briefDescription");
  // Re-rend ici (contrairement au title-input de la carte musicale) car ce champ conditionne
  // l'activation du bouton "Verrouiller le brief" — sans re-rendu l'état du bouton resterait périmé.
  if (desc) desc.addEventListener("change", () => { b.description = desc.value; touch(project); persist(); render(); });
  document.querySelectorAll("[data-field]").forEach((input) => input.addEventListener("change", () => {
    b.fields[input.dataset.field] = input.value; touch(project); persist();
  }));
  document.getElementById("lockBrief")?.addEventListener("click", () => {
    if (!b.direction || !b.description.trim()) return;
    b.locked = true; b.lockedAt = Date.now();
    const step = project.steps.find((s) => s.id === "brief"); if (step) step.status = "done";
    const next = project.steps.find((s) => s.id === "bibles"); if (next && next.status === "pending") next.status = "active";
    if (next) project.activeStepId = next.id;
    touch(project); persist(); render();
    toast("Brief créatif verrouillé.");
  });
  document.getElementById("reopenBrief")?.addEventListener("click", () => {
    b.locked = false;
    const step = project.steps.find((s) => s.id === "brief"); if (step) step.status = "active";
    const next = project.steps.find((s) => s.id === "bibles"); if (next && next.status === "active") next.status = "pending";
    touch(project); persist(); render();
  });
}

function bindBiblesStep(project) {
  document.getElementById("addCanon")?.addEventListener("click", () => {
    project.canon.push({
      id: uid(), category: "personnage", name: "", description: "",
      obligatoire: [], prefere: [], interdit: [], sourceId: null, status: "proposé", createdAt: Date.now(),
    });
    touch(project); persist(); render();
  });
  document.querySelectorAll("[data-delcanon]").forEach((btn) => btn.addEventListener("click", () => {
    project.canon = project.canon.filter((c) => c.id !== btn.dataset.delcanon);
    touch(project); persist(); render();
  }));
  const findCanon = (id) => project.canon.find((c) => c.id === id);
  document.querySelectorAll("[data-canoncat]").forEach((el) => el.addEventListener("change", () => {
    const c = findCanon(el.dataset.canoncat); if (c) { c.category = el.value; touch(project); persist(); }
  }));
  document.querySelectorAll("[data-canonname]").forEach((el) => el.addEventListener("change", () => {
    const c = findCanon(el.dataset.canonname); if (c) { c.name = el.value; touch(project); persist(); }
  }));
  document.querySelectorAll("[data-canondesc]").forEach((el) => el.addEventListener("change", () => {
    const c = findCanon(el.dataset.canondesc); if (c) { c.description = el.value; touch(project); persist(); }
  }));
  document.querySelectorAll("[data-canonsrc]").forEach((el) => el.addEventListener("change", () => {
    const c = findCanon(el.dataset.canonsrc); if (c) { c.sourceId = el.value || null; touch(project); persist(); }
  }));
  document.querySelectorAll("[data-canonoblig]").forEach((el) => el.addEventListener("change", () => {
    const c = findCanon(el.dataset.canonoblig); if (c) { c.obligatoire = textToTags(el.value); touch(project); persist(); }
  }));
  document.querySelectorAll("[data-canonpref]").forEach((el) => el.addEventListener("change", () => {
    const c = findCanon(el.dataset.canonpref); if (c) { c.prefere = textToTags(el.value); touch(project); persist(); }
  }));
  document.querySelectorAll("[data-canoninterdit]").forEach((el) => el.addEventListener("change", () => {
    const c = findCanon(el.dataset.canoninterdit); if (c) { c.interdit = textToTags(el.value); touch(project); persist(); }
  }));
  document.querySelectorAll("[data-canonstatus]").forEach((el) => el.addEventListener("change", () => {
    const c = findCanon(el.dataset.canonstatus); if (c) { c.status = el.value; touch(project); persist(); }
  }));
  document.getElementById("lockBibles")?.addEventListener("click", () => {
    if (!project.canon.length) return;
    project.canonLocked = true;
    project.canon.forEach((c) => { c.status = "verrouillé"; });
    const step = project.steps.find((s) => s.id === "bibles"); if (step) step.status = "done";
    const next = project.steps.find((s) => s.id === "histoire"); if (next && next.status === "pending") next.status = "active";
    if (next) project.activeStepId = next.id;
    touch(project); persist(); render();
    toast("Bibles visuelles verrouillées.");
  });
  document.getElementById("reopenBibles")?.addEventListener("click", () => {
    project.canonLocked = false;
    const step = project.steps.find((s) => s.id === "bibles"); if (step) step.status = "active";
    const next = project.steps.find((s) => s.id === "histoire"); if (next && next.status === "active") next.status = "pending";
    touch(project); persist(); render();
  });
}

function bindHistoireStep(project) {
  const st = project.story;
  document.getElementById("proposeStoryBtn")?.addEventListener("click", () => {
    Object.assign(st, proposeStory(project));
    touch(project); persist(); render();
    toast("Histoire proposée — à corriger librement.");
  });
  document.getElementById("reproposeStory")?.addEventListener("click", () => {
    Object.assign(st, proposeStory(project));
    touch(project); persist(); render();
  });
  const arc = document.getElementById("storyArc");
  // Re-rend (comme la description du brief) car ce champ conditionne le bouton de verrouillage.
  if (arc) arc.addEventListener("change", () => { st.arc = arc.value; touch(project); persist(); render(); });
  const motifs = document.getElementById("storyMotifs");
  if (motifs) motifs.addEventListener("change", () => { st.motifs = textToTags(motifs.value); touch(project); persist(); });
  document.querySelectorAll("[data-approach]").forEach((el) => el.addEventListener("change", () => {
    const a = st.sectionApproach.find((x) => x.sectionId === el.dataset.approach);
    if (a) { a.direction = el.value; touch(project); persist(); }
  }));
  document.getElementById("lockStory")?.addEventListener("click", () => {
    if (!st.arc.trim()) return;
    st.locked = true; st.lockedAt = Date.now();
    const step = project.steps.find((s) => s.id === "histoire"); if (step) step.status = "done";
    const next = project.steps.find((s) => s.id === "storyboard"); if (next && next.status === "pending") next.status = "active";
    if (next) project.activeStepId = next.id;
    touch(project); persist(); render();
    toast("Histoire verrouillée.");
  });
  document.getElementById("reopenStory")?.addEventListener("click", () => {
    st.locked = false;
    const step = project.steps.find((s) => s.id === "histoire"); if (step) step.status = "active";
    const next = project.steps.find((s) => s.id === "storyboard"); if (next && next.status === "active") next.status = "pending";
    touch(project); persist(); render();
  });
}

function bindStoryboardStep(project) {
  const sb = project.storyboard;
  document.getElementById("generateShotsBtn")?.addEventListener("click", () => {
    sb.shots = proposeShots(project);
    touch(project); persist(); render();
    toast(`${sb.shots.length} plan${sb.shots.length > 1 ? "s" : ""} proposé${sb.shots.length > 1 ? "s" : ""} — à ajuster.`);
  });
  document.getElementById("regenShots")?.addEventListener("click", () => {
    sb.shots = proposeShots(project);
    touch(project); persist(); render();
    toast("Plans régénérés.");
  });
  const findShot = (id) => sb.shots.find((s) => s.id === id);
  document.querySelectorAll("[data-shotdir]").forEach((el) => el.addEventListener("change", () => { const s = findShot(el.dataset.shotdir); if (s) { s.direction = el.value; touch(project); persist(); } }));
  document.querySelectorAll("[data-shotaction]").forEach((el) => el.addEventListener("change", () => { const s = findShot(el.dataset.shotaction); if (s) { s.action = el.value; touch(project); persist(); } }));
  document.querySelectorAll("[data-shotdecor]").forEach((el) => el.addEventListener("change", () => { const s = findShot(el.dataset.shotdecor); if (s) { s.decor = el.value; touch(project); persist(); } }));
  document.querySelectorAll("[data-shotcamera]").forEach((el) => el.addEventListener("change", () => { const s = findShot(el.dataset.shotcamera); if (s) { s.camera = el.value; touch(project); persist(); } }));
  document.querySelectorAll("[data-shotemotion]").forEach((el) => el.addEventListener("change", () => { const s = findShot(el.dataset.shotemotion); if (s) { s.emotion = el.value; touch(project); persist(); } }));
  document.querySelectorAll("[data-shotprompt]").forEach((el) => el.addEventListener("change", () => { const s = findShot(el.dataset.shotprompt); if (s) { s.prompt = el.value; touch(project); persist(); } }));
  document.querySelectorAll("[data-shotrefs]").forEach((el) => el.addEventListener("change", () => {
    const s = findShot(el.dataset.shotrefs);
    if (s) { s.references = Array.from(el.selectedOptions).map((o) => o.value); touch(project); persist(); }
  }));
  document.getElementById("lockStoryboard")?.addEventListener("click", () => {
    if (!sb.shots.length) return;
    sb.locked = true; sb.lockedAt = Date.now();
    const step = project.steps.find((s) => s.id === "storyboard"); if (step) step.status = "done";
    const next = project.steps.find((s) => s.id === "images"); if (next && next.status === "pending") next.status = "active";
    if (next) project.activeStepId = next.id;
    touch(project); persist(); render();
    toast("Storyboard verrouillé.");
  });
  document.getElementById("reopenStoryboard")?.addEventListener("click", () => {
    sb.locked = false;
    const step = project.steps.find((s) => s.id === "storyboard"); if (step) step.status = "active";
    const next = project.steps.find((s) => s.id === "images"); if (next && next.status === "active") next.status = "pending";
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
