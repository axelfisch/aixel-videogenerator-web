// AiXel VideoGenerator — cockpit (V0.5 : Nouveau projet + Sources et inventaire)
// Vanilla JS, sans framework ni étape de build — état + rendu + persistance locale
// (localStorage pour les métadonnées, IndexedDB pour les fichiers eux-mêmes — voir db.js).
const BUILD = "V3 · 2026-09-02 (connecteur de génération d'images)";
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

// Image Lab (§8.8) — cinq dimensions de vérification citées dans le document d'architecture
// ("identité, composition, accessoires, texte et style"). Vérification manuelle et honnête :
// aucune détection automatique, juste une checklist pour comparer des variantes déjà importées
// (pas de génération payante avant V3).
const IMAGE_CHECKS = [
  { key: "identite", label: "Identité" },
  { key: "composition", label: "Composition" },
  { key: "accessoires", label: "Accessoires" },
  { key: "texte", label: "Texte" },
  { key: "style", label: "Style" },
];
const IMAGE_CHECK_STATES = ["à vérifier", "conforme", "à corriger"];

function getImageSources(project) {
  return project.sources.filter((s) => s.category === "image" || s.category === "logo");
}
function shotCanonRefs(shot, project) {
  return (shot.references || []).map((id) => project.canon.find((c) => c.id === id)).filter(Boolean);
}
function defaultShotImage(sourceId) {
  return {
    id: uid(),
    sourceId: sourceId || null,
    addedAt: Date.now(),
    status: "proposé",
    checks: Object.fromEntries(IMAGE_CHECKS.map((c) => [c.key, "à vérifier"])),
    notes: "",
  };
}
function defaultImagelab() { return { locked: false, lockedAt: null }; }
function defaultAnimatic() { return { locked: false, lockedAt: null }; }
function defaultProduction() { return { locked: false, lockedAt: null }; }
function defaultShotVideo(sourceId) {
  return { id: uid(), sourceId: sourceId || null, addedAt: Date.now(), status: "proposé", notes: "" };
}

// V3 (§8.10 Production Router) — premier connecteur de génération, réservé aux images tests
// (moins cher, plus rapide à itérer que la vidéo — §13 "aucun rendu coûteux comme test
// d'interface"). L'appel réel passe par des fonctions Netlify (netlify/functions/generate-image*)
// qui gardent la clé API côté serveur ; le client ne connaît que ce fournisseur normalisé.
const GEN_PROVIDER = { id: "replicate-flux-schnell", label: "Replicate — FLUX.1 [schnell]", costPerImage: 0.003 };
const genBusy = new Set(); // ids de plans en cours de génération (état transitoire, pas persisté)

// Compose le prompt envoyé au fournisseur à partir du plan (action/décor/caméra), des bibles
// visuelles verrouillées liées (propriétés obligatoires) et du brief (palette/style) — jamais
// inventé : uniquement ce qu'Axel a déjà écrit ailleurs dans le projet.
function buildImagePrompt(sh, project) {
  const refs = shotCanonRefs(sh, project);
  const oblig = [...new Set(refs.flatMap((c) => c.obligatoire || []))];
  const bits = [];
  const base = sh.prompt || sh.action || "";
  if (base.trim()) bits.push(base.trim());
  if (sh.decor && !bits.some((b) => b.includes(sh.decor))) bits.push(sh.decor);
  if (sh.camera) bits.push(sh.camera);
  if (oblig.length) bits.push(oblig.join(", "));
  if (project.brief.fields.palette) bits.push(project.brief.fields.palette);
  if (project.brief.fields.style) bits.push(project.brief.fields.style);
  return bits.filter(Boolean).join(", ");
}
function buildNegativePrompt(sh, project) {
  const refs = shotCanonRefs(sh, project);
  const interdit = [...new Set(refs.flatMap((c) => c.interdit || []))];
  const globalInterdit = textToTags(project.brief.fields.interdits);
  return [...new Set([...interdit, ...globalInterdit])].join(", ");
}

// Appelle le proxy Netlify (jamais le fournisseur directement) et renvoie un Blob prêt à stocker
// localement. Attend la réponse synchrone (~1-3s pour FLUX.1 schnell) puis, si besoin, interroge
// generate-image-status.js jusqu'à un état terminal.
async function runImageGeneration(prompt, negativePrompt) {
  const res = await fetch("/.netlify/functions/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, negativePrompt }),
  });
  let data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Échec de la génération (connecteur indisponible).");
  let attempts = 0;
  while (data.status === "processing" && attempts < 40) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`/.netlify/functions/generate-image-status?id=${encodeURIComponent(data.id)}`);
    data = await poll.json().catch(() => ({}));
    if (!poll.ok) throw new Error(data.error || "Échec du suivi de la génération.");
    attempts++;
  }
  if (data.status !== "succeeded") throw new Error(data.error || "La génération a échoué ou a pris trop de temps.");
  const blob = await (await fetch(`data:${data.mime || "image/png"};base64,${data.imageBase64}`)).blob();
  return { blob, cost: data.cost != null ? data.cost : GEN_PROVIDER.costPerImage };
}

// V3.5 (§8.10 Production Router) — connecteur vidéo, réservé aux plans dont l'image test est déjà
// choisie (jamais en masse, §8.10). Fournisseur : Replicate (modèle Wan 2.1 image→vidéo, 480p) —
// et non TokenRouter comme envisagé initialement (2026-09-02) : le contrat d'API vidéo de
// TokenRouter n'est pas documenté publiquement, alors que celui-ci l'est, réutilise le jeton
// Replicate déjà configuré et déjà facturé chez Axel, sans nouvelle mise en place. À reconsidérer
// si Axel confirme le format exact de l'API vidéo TokenRouter depuis son tableau de bord.
const VIDEO_GEN_PROVIDER = {
  id: "replicate-wan2.1-i2v-480p",
  label: "Replicate — Wan 2.1 (image→vidéo, 480p)",
  costPerSecond: 0.09, // tarif Replicate au 2026-09 (à réviser si le fournisseur change ses prix)
  fps: 16,
  maxFrames: 100, // ≈ 6.25s à 16 im/s — plafond du modèle
};
function videoFramesFor(durSec) {
  return Math.max(5, Math.min(VIDEO_GEN_PROVIDER.maxFrames, Math.round(durSec * VIDEO_GEN_PROVIDER.fps)));
}
function videoCostFor(durSec) {
  const frames = videoFramesFor(durSec);
  return (frames / VIDEO_GEN_PROVIDER.fps) * VIDEO_GEN_PROVIDER.costPerSecond;
}
// Réutilise le même prompt que l'image test choisie (déjà validé visuellement par Axel), sans
// jamais rien inventer de plus — juste ce qu'il a déjà écrit ailleurs dans le projet. Priorité :
// un prompt vidéo explicitement retouché > le prompt qui a servi à générer l'image choisie (le
// meilleur reflet de ce que ce plan montre) > un prompt recomposé depuis action/décor/caméra si
// l'image choisie a été importée plutôt que générée.
function buildVideoPrompt(sh, project) {
  if (sh.genVideoPrompt != null && sh.genVideoPrompt !== "") return sh.genVideoPrompt;
  if (sh.genPrompt != null && sh.genPrompt !== "") return sh.genPrompt;
  return buildImagePrompt(sh, project);
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Échec de lecture de l'image de référence."));
    reader.readAsDataURL(blob);
  });
}
// Les fonctions Netlify (AWS Lambda dessous) refusent toute requête/réponse synchrone au-delà de
// ~6 Mo — une image de référence importée en haute résolution dépasserait vite cette limite une
// fois encodée en base64 (+33%), et Netlify la rejette AVANT même que notre code ne s'exécute
// (d'où un message d'erreur générique de la plateforme plutôt qu'une erreur claire du connecteur —
// bug réel rencontré par Axel le 2026-09-02). On downscale donc toujours l'image côté client avant
// envoi : Wan 2.1 480p ne tire de toute façon aucun bénéfice d'une image source en haute résolution
// (sa case d'entrée est plafonnée à 832×480).
async function resizeImageForVideoGen(blob, maxDim = 960, quality = 0.85) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Échec de la préparation de l'image de référence."))), "image/jpeg", quality);
  });
}
// Anime l'image test choisie du plan (image→vidéo) via le proxy Netlify. La génération vidéo est
// nettement plus lente qu'une image (souvent 30s-2min) : on attend une réponse rapide côté
// serveur, sinon on interroge generate-video-status.js jusqu'à un état terminal. Le résultat revient
// comme une URL Replicate (pas en base64, même limite de taille côté réponse) — le client la
// télécharge lui-même directement pour la stocker localement.
async function runVideoGeneration(prompt, imageBlob, durSec) {
  const resized = await resizeImageForVideoGen(imageBlob);
  const imageDataUrl = await blobToDataUrl(resized);
  if (imageDataUrl.length > 4.5 * 1024 * 1024) {
    throw new Error("Image de référence trop volumineuse même après compression — réessaie avec une autre image.");
  }
  const frames = videoFramesFor(durSec);
  const res = await fetch("/.netlify/functions/generate-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image: imageDataUrl, frames, fps: VIDEO_GEN_PROVIDER.fps }),
  });
  let data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Échec de la génération vidéo (connecteur indisponible).");
  let attempts = 0;
  while (data.status === "processing" && attempts < 90) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(`/.netlify/functions/generate-video-status?id=${encodeURIComponent(data.id)}&frames=${frames}`);
    data = await poll.json().catch(() => ({}));
    if (!poll.ok) throw new Error(data.error || "Échec du suivi de la génération vidéo.");
    attempts++;
  }
  if (data.status !== "succeeded") throw new Error(data.error || "La génération vidéo a échoué ou a pris trop de temps.");
  if (!data.videoUrl) throw new Error("La génération a réussi mais n'a renvoyé aucune vidéo.");
  const videoRes = await fetch(data.videoUrl);
  if (!videoRes.ok) throw new Error("Vidéo générée introuvable au moment de la récupérer (lien peut-être expiré) — réessaie.");
  const blob = await videoRes.blob();
  return { blob, cost: data.cost != null ? data.cost : videoCostFor(durSec) };
}

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
        images: [], selectedImageId: null, genPrompt: null,
        videos: [], selectedVideoId: null, genVideoPrompt: null,
      });
    }
  });
  return shots;
}

// Import en masse (Storyboard) — reconnaît des lignes "Action :", "Décor :", "Caméra :", "Émotion :"
// (accents/majuscules/tirets tolérés), regroupe en blocs (un nouveau bloc démarre à chaque "Action :"),
// ignore tout le reste (titres de section, timecodes, texte libre). Un bloc = un plan, dans l'ordre.
function parseBulkShotBlocks(text) {
  const re = /^\s*(?:[-*•]\s*)?\*{0,2}(action|d[ÉéEe]cor|cam[ÉéEe]ra|[ÉéEe]motion)\*{0,2}\s*:\s*(.+?)\s*\**\s*$/i;
  const keyMap = { action: "action", decor: "decor", camera: "camera", emotion: "emotion" };
  const normalizeKey = (raw) => {
    const k = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); // decor/camera/emotion normalises
    return keyMap[k] || k;
  };
  const blocks = [];
  let current = null;
  text.split(/\r?\n/).forEach((line) => {
    const m = line.match(re);
    if (!m) return;
    const key = normalizeKey(m[1]);
    const value = m[2].trim();
    if (key === "action") {
      if (current) blocks.push(current);
      current = {};
    }
    if (!current) current = {};
    current[key] = value;
  });
  if (current) blocks.push(current);
  return blocks;
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
    imagelab: defaultImagelab(),
    animatic: defaultAnimatic(),
    production: defaultProduction(),
    generations: [],
    videoGenerations: [],
    creditsAvoided: 0,
  };
}

// Rétrocompatibilité : les projets créés avant V1.5/V2/V2.5/V3 (ex. sur le navigateur d'Axel)
// n'ont pas encore ces champs en mémoire locale — on les complète sans toucher au reste.
function migrateProject(p) {
  if (!p.brief) p.brief = defaultBrief();
  if (!p.canon) p.canon = [];
  if (p.canonLocked == null) p.canonLocked = false;
  if (!p.story) p.story = defaultStory();
  if (!p.storyboard) p.storyboard = defaultStoryboard();
  if (!p.imagelab) p.imagelab = defaultImagelab();
  if (!p.animatic) p.animatic = defaultAnimatic();
  if (!p.production) p.production = defaultProduction();
  if (!p.generations) p.generations = [];
  if (!p.videoGenerations) p.videoGenerations = [];
  (p.storyboard.shots || []).forEach((sh) => {
    if (!sh.images) sh.images = [];
    if (sh.selectedImageId === undefined) sh.selectedImageId = null;
    if (sh.genPrompt === undefined) sh.genPrompt = null;
    if (!sh.videos) sh.videos = [];
    if (sh.selectedVideoId === undefined) sh.selectedVideoId = null;
    if (sh.genVideoPrompt === undefined) sh.genVideoPrompt = null;
  });
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
  // migrateProject() ici aussi : sur un navigateur totalement neuf (aucun localStorage), le projet
  // démo doit recevoir les mêmes champs par défaut (story/storyboard/imagelab/animatic) que les
  // projets migrés depuis une session existante — sinon Histoire/Storyboard/Images/Animatique
  // plantent au premier chargement d'un nouveau navigateur.
  const demo = migrateProject(demoProjectRecord());
  return { currentProjectId: demo.id, projects: { [demo.id]: demo }, ui: { projectMenuOpen: false, newProjectOpen: false, draftName: "", draftArtist: "", confirmDeleteId: null, lightboxSrc: null } };
}

let state = load();
const imageUrlCache = new Map(); // sourceId -> object URL, pour éviter de relire IndexedDB à chaque rendu
const videoUrlCache = new Map(); // sourceId -> object URL, pour les vidéos générées (Production)

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = { ...defaultState(), ...parsed, ui: { projectMenuOpen: false, newProjectOpen: false, draftName: "", draftArtist: "", confirmDeleteId: null, lightboxSrc: null } };
      Object.values(merged.projects).forEach(migrateProject);
      return merged;
    }
    // Migration depuis la V0 (un seul projet BMW/BNC codé en dur)
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old) {
      const parsedOld = JSON.parse(old);
      const demo = migrateProject({ ...demoProjectRecord(), ...parsedOld, sources: demoProjectRecord().sources, sourcesLocked: true });
      return { currentProjectId: demo.id, projects: { [demo.id]: demo }, ui: { projectMenuOpen: false, newProjectOpen: false, draftName: "", draftArtist: "", confirmDeleteId: null, lightboxSrc: null } };
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
  loadVideoThumbnails(project);
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
          <div class="project-card" data-open="${p.id}" role="button" tabindex="0">
            <button class="pc-delete" data-delete="${p.id}" title="Supprimer le projet" aria-label="Supprimer le projet">✕</button>
            <div class="pc-top"><b>${escapeHtml(p.name)}</b><span class="pc-pct">${progressPct(p)}%</span></div>
            <div class="pc-artist">${escapeHtml(p.artist || "—")}</div>
            <div class="process-bar"><i style="width:${progressPct(p)}%"></i></div>
            <div class="pc-meta">${p.sources.length} source${p.sources.length > 1 ? "s" : ""} · mis à jour ${fmtRelative(p.updatedAt)}</div>
          </div>
        `).join("")}
      </div>
    </div>
    ${state.ui.newProjectOpen ? renderNewProjectModal() : ""}
    ${state.ui.confirmDeleteId ? renderDeleteProjectModal() : ""}
  `;
}

function bindLibrary() {
  const nc = document.getElementById("newProjectCard");
  if (nc) nc.addEventListener("click", () => { state.ui.newProjectOpen = true; render(); });
  document.querySelectorAll(".project-card[data-open]").forEach((el) => {
    const open = () => { state.currentProjectId = el.dataset.open; persist(); render(); };
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
  document.querySelectorAll("[data-delete]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      state.ui.confirmDeleteId = el.dataset.delete;
      render();
    });
  });
  bindNewProjectModal();
  bindDeleteProjectModal();
}

function renderDeleteProjectModal() {
  const p = state.projects[state.ui.confirmDeleteId];
  if (!p) return "";
  return `
    <div class="modal-backdrop" id="deleteBackdrop">
      <div class="modal">
        <h2>Supprimer « ${escapeHtml(p.name)} » ?</h2>
        <p class="modal-hint">Action définitive : toutes les sources importées (audio, images, textes) et toute la progression de ce projet seront effacées de cet appareil. Impossible à annuler.</p>
        <div class="modal-actions">
          <button class="btn ghost" id="deleteCancel">Annuler</button>
          <button class="btn danger" id="deleteConfirm">Supprimer définitivement</button>
        </div>
      </div>
    </div>
  `;
}
function bindDeleteProjectModal() {
  const backdrop = document.getElementById("deleteBackdrop");
  if (!backdrop) return;
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) { state.ui.confirmDeleteId = null; render(); } });
  document.getElementById("deleteCancel").addEventListener("click", () => { state.ui.confirmDeleteId = null; render(); });
  document.getElementById("deleteConfirm").addEventListener("click", async () => {
    const id = state.ui.confirmDeleteId;
    await deleteProjectCompletely(id);
    state.ui.confirmDeleteId = null;
    persist();
    render();
    toast("Projet supprimé.");
  });
}

async function deleteProjectCompletely(projectId) {
  const p = state.projects[projectId];
  if (!p) return;
  for (const s of p.sources) {
    try { await AiXelDB.deleteBlob(s.id); } catch {}
    if (imageUrlCache.has(s.id)) { URL.revokeObjectURL(imageUrlCache.get(s.id)); imageUrlCache.delete(s.id); }
  }
  delete state.projects[projectId];
  if (state.currentProjectId === projectId) state.currentProjectId = null;
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
        <span class="pilot-badge">${project.id === "bmw-bnc" ? "PILOTE · V0" : "V3"}</span>
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
      ${list.map((p) => `
        <div class="pm-row">
          <button class="pm-item ${p.id === state.currentProjectId ? "current" : ""}" data-switch="${p.id}">${escapeHtml(p.name)}</button>
          <button class="pm-delete" data-delete="${p.id}" title="Supprimer le projet" aria-label="Supprimer le projet">✕</button>
        </div>
      `).join("")}
      <button class="pm-item pm-new" data-newproject="1">+ Nouveau projet</button>
      <button class="pm-item pm-home" data-home="1">🏠 Bibliothèque</button>
    </div>
    ${state.ui.confirmDeleteId ? renderDeleteProjectModal() : ""}
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
  if (step.id === "images") return `<div class="crumb">${crumb}</div>` + renderImagesStep(project);
  if (step.id === "animatique") return `<div class="crumb">${crumb}</div>` + renderAnimatiqueStep(project);
  if (step.id === "production") return `<div class="crumb">${crumb}</div>` + renderProductionStep(project);
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
        <div class="metric bpm-metric">
          ${project.audioLocked
            ? `<b>${Math.round(a.bpm)}</b>`
            : `<input type="number" id="bpmOverride" class="bpm-input" value="${Math.round(a.bpm)}" min="40" max="220" step="1" />`}
          <small>${a.bpmManual ? "BPM (corrigé)" : "BPM estimé"}</small>
        </div>
        <div class="metric"><b>${fmtTime(a.duration)}</b><small>durée</small></div>
        <div class="metric"><b>${(a.peak * 100).toFixed(0)}%</b><small>crête</small></div>
        <div class="metric"><b style="font-size:14px">${a.profile}</b><small>profil dominant</small></div>
      </div>
      ${!project.audioLocked ? `<p class="page-sub" style="margin:10px 0 0;font-size:11.5px">L'estimation de tempo est la partie la moins fiable de l'analyse — corrige-la si elle ne colle pas à ton oreille (métronome, tap tempo…), la carte musicale utilisera ta valeur.</p>` : ""}
    </div>
    <div class="card replace-audio-card">
      <h2>Remplacer le fichier audio</h2>
      <p class="page-sub" style="margin-top:-6px">Pour utiliser une autre version du même morceau (autre export, durée légèrement différente…) sans perdre ton travail. <b>Les sections et les plans du storyboard déjà écrits ne sont jamais touchés</b> — seules la référence audio et ses métriques (durée, BPM, forme d'onde) sont mises à jour.</p>
      <input type="file" id="replaceAudioInput" accept="audio/*" hidden />
      <button class="btn ghost" id="replaceAudioBtn">📀 Choisir un autre fichier audio →</button>
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
      ${!locked ? `
      <div class="card bulk-card">
        <h2>Coller en masse <span style="font-weight:400;color:var(--faint);font-size:11px">— remplit les plans dans l'ordre à partir d'un texte structuré</span></h2>
        <p class="page-sub" style="margin:4px 0 10px">Un bloc par plan, dans l'ordre chronologique, avec des lignes "Action :", "Décor :", "Caméra :", "Émotion :" (accents ou pas, tirets ou pas — peu importe). Les titres de section et autre texte autour sont ignorés automatiquement. Colle le texte directement (Cmd+V), ou dépose un fichier .md/.txt sur la zone.</p>
        <textarea id="bulkShotsInput" class="brief-textarea" rows="6" placeholder="Action : ...&#10;Décor : ...&#10;Caméra : ...&#10;Émotion : ...&#10;&#10;Action : ...&#10;...&#10;&#10;(ou dépose ici un fichier .md/.txt)"></textarea>
        <button class="btn primary" id="bulkShotsApply" style="margin-top:10px">Importer dans les plans →</button>
      </div>
      ` : ""}
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

// ---------- Étape Images tests (Image Lab, §8.8) ----------
// Pas de génération ici (le premier connecteur arrive en V3) : on compare des variantes déjà
// importées dans les sources, avec une checklist manuelle (identité/composition/accessoires/
// texte/style, telle que décrite dans le document d'architecture) — jamais une vérification
// automatique qu'on ne saurait pas garantir.

function renderImagesStep(project) {
  const shots = project.storyboard.shots;
  const lab = project.imagelab;
  const locked = lab.locked;
  const imgSources = getImageSources(project);
  const selectedCount = shots.filter((s) => s.selectedImageId).length;
  const okGens = project.generations.filter((g) => g.status === "réussi");
  const genSpend = okGens.reduce((sum, g) => sum + (g.cost || 0), 0);

  if (!shots.length) {
    return `
      <div class="page-head"><h1>Images tests</h1></div>
      <p class="page-sub">Aucun plan pour l'instant.</p>
      <div class="card empty-card"><div class="empty-hint">Génère et verrouille le storyboard pour tester des images par plan.</div></div>
    `;
  }

  return `
    <div class="page-head">
      <h1>Images tests</h1>
      <span class="status-chip ${locked ? "" : "chip-pending"}">${locked ? "Images verrouillées" : `${selectedCount}/${shots.length} plan${shots.length > 1 ? "s" : ""} avec une image choisie`}</span>
    </div>
    <p class="page-sub">Compare des variantes par plan et valide-les avant l'animatique — identité, composition, accessoires, texte, style. Associe des images déjà importées dans les sources, ou génère un test directement (Replicate — FLUX.1 [schnell], ≈ $${GEN_PROVIDER.costPerImage.toFixed(3)}/image). Ce connecteur reste réservé aux tests : la génération des plans définitifs approuvés arrive avec la Production (prochaine tranche).</p>
    ${okGens.length ? `<p class="gen-summary">✨ ${okGens.length} image${okGens.length > 1 ? "s" : ""} générée${okGens.length > 1 ? "s" : ""} ce projet · ≈ $${genSpend.toFixed(3)} dépensés</p>` : ""}
    ${!project.storyboard.locked ? `<div class="dup-banner">ℹ️ Le storyboard n'est pas encore verrouillé — les plans peuvent encore changer.</div>` : ""}
    ${!imgSources.length ? `<div class="dup-banner">ℹ️ Aucune image importée pour l'instant — ajoute des images dans Sources, ou génère directement un test ci-dessous.</div>` : ""}

    ${locked ? `<div class="locked-banner">🔒 Images tests verrouillées — référence pour l'animatique.
      <button class="btn small reopen" id="reopenImages">Rouvrir</button></div>` : ""}

    ${groupShotsBySection(project).map(([, sShots]) => `
      <div class="card">
        <div class="section-head"><h2>${escapeHtml(sShots[0].sectionLabel)}</h2><span class="count">${sShots.length} plan${sShots.length > 1 ? "s" : ""}</span></div>
        <div class="shot-list">
          ${sShots.map((sh, i) => renderImageShotRow(sh, i, project, locked, imgSources)).join("")}
        </div>
      </div>
    `).join("")}

    ${!locked ? `
      <div class="card decision-card">
        <div class="decision-icon">✦</div>
        <div class="decision-body">
          <h3>Verrouiller les images tests</h3>
          <p>Les images choisies deviennent la référence pour l'animatique.${selectedCount === 0 ? " Choisis au moins une image avant de verrouiller." : ""}</p>
        </div>
        <div class="decision-actions"><button class="btn primary" id="lockImages" ${selectedCount ? "" : "disabled"}>Verrouiller les images tests →</button></div>
      </div>
    ` : ""}
    ${state.ui.lightboxSrc ? renderImageLightbox() : ""}
  `;
}

function renderImageLightbox() {
  return `
    <div class="modal-backdrop lightbox-backdrop" id="lightboxBackdrop">
      <button class="lightbox-close" id="lightboxClose" aria-label="Fermer">✕</button>
      <img class="lightbox-img" src="${state.ui.lightboxSrc}" alt="" />
    </div>
  `;
}

function renderImageShotRow(sh, i, project, locked, imgSources) {
  const refs = shotCanonRefs(sh, project);
  const oblig = [...new Set(refs.flatMap((c) => c.obligatoire || []))];
  const interdit = [...new Set(refs.flatMap((c) => c.interdit || []))];
  const usedIds = new Set(sh.images.map((im) => im.sourceId));
  const available = imgSources.filter((s) => !usedIds.has(s.id));

  return `
    <div class="shot-row">
      <div class="shot-top">
        <span>0${i + 1}</span><span>${fmtTime(sh.start)} · ${sh.dur.toFixed(1)}s</span>
        <span>${escapeHtml(sh.action || "(action à préciser)")}</span>
      </div>
      ${(oblig.length || interdit.length) ? `
        <div class="checklist-hint">
          ${oblig.length ? `<div><b>Obligatoire :</b> ${escapeHtml(oblig.join(", "))}</div>` : ""}
          ${interdit.length ? `<div><b>Interdit :</b> ${escapeHtml(interdit.join(", "))}</div>` : ""}
        </div>
      ` : ""}
      <div class="image-grid">
        ${sh.images.map((im) => renderImageCandidate(im, sh, project, locked)).join("")}
        ${!locked && available.length ? `
          <div class="image-add">
            <select data-imgsrcpick="${sh.id}">
              ${available.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}
            </select>
            <button class="btn small" data-addimage="${sh.id}">+ Ajouter une image test</button>
          </div>
        ` : ""}
      </div>
      ${!locked ? renderGenPanel(sh, project) : ""}
    </div>
  `;
}

function renderGenPanel(sh, project) {
  const promptValue = sh.genPrompt != null ? sh.genPrompt : buildImagePrompt(sh, project);
  const busy = genBusy.has(sh.id);
  const lastFailed = [...project.generations].reverse().find((g) => g.shotId === sh.id && g.status === "échoué");
  return `
    <div class="gen-panel">
      <label class="field"><span>Prompt envoyé à la génération (basé sur le plan + les bibles verrouillées, modifiable)</span>
        <textarea data-genprompt="${sh.id}" rows="2" placeholder="Décris l'image à générer…">${escapeHtml(promptValue)}</textarea>
      </label>
      ${lastFailed && !busy ? `<div class="gen-error">⚠ Dernier essai échoué : ${escapeHtml(lastFailed.error || "erreur inconnue")}</div>` : ""}
      <div class="gen-row">
        <span class="gen-cost">≈ $${GEN_PROVIDER.costPerImage.toFixed(3)} / image · ${GEN_PROVIDER.label}</span>
        <button class="btn small" data-genimage="${sh.id}" ${busy ? "disabled" : ""}>${busy ? "Génération en cours…" : "✨ Générer une image test"}</button>
      </div>
    </div>
  `;
}

function renderImageCandidate(im, sh, project, locked) {
  const src = project.sources.find((s) => s.id === im.sourceId);
  const isSelected = sh.selectedImageId === im.id;
  return `
    <div class="image-card ${isSelected ? "selected" : ""}">
      <div class="image-thumb" data-thumb="${im.sourceId}">${imageUrlCache.get(im.sourceId) ? `<img src="${imageUrlCache.get(im.sourceId)}" alt="" />` : ""}</div>
      <div class="image-card-body">
        <div class="image-card-name"><span class="name-text">${escapeHtml(src ? src.name : "Image introuvable")}</span>${src && src.generated ? `<span class="gen-badge">IA</span>` : ""}</div>
        <select class="canon-category" data-imagestatus="${im.id}" ${locked ? "disabled" : ""}>
          <option value="proposé" ${im.status === "proposé" ? "selected" : ""}>Proposé</option>
          <option value="à corriger" ${im.status === "à corriger" ? "selected" : ""}>À corriger</option>
          <option value="approuvé" ${im.status === "approuvé" ? "selected" : ""}>Approuvé</option>
        </select>
        <div class="check-grid">
          ${IMAGE_CHECKS.map((c) => `
            <label class="check-item"><span>${c.label}</span>
              <select data-imagecheck="${im.id}:${c.key}" ${locked ? "disabled" : ""}>
                ${IMAGE_CHECK_STATES.map((v) => `<option value="${v}" ${im.checks[c.key] === v ? "selected" : ""}>${v}</option>`).join("")}
              </select>
            </label>
          `).join("")}
        </div>
        <textarea data-imagenotes="${im.id}" rows="1" placeholder="Notes…" ${locked ? "disabled" : ""}>${escapeHtml(im.notes)}</textarea>
        ${!locked ? `
          <div class="image-card-actions">
            <button class="btn small ${isSelected ? "primary" : ""}" data-selectimage="${sh.id}:${im.id}">${isSelected ? "✓ Choisie" : "Choisir"}</button>
            <button class="src-del" data-delimage="${sh.id}:${im.id}" aria-label="Retirer">✕</button>
          </div>
        ` : isSelected ? `<div class="image-card-actions"><span class="status-chip small">✓ Choisie</span></div>` : ""}
      </div>
    </div>
  `;
}

// ---------- Étape Animatique (Animatic Engine, §8.9) ----------
// Aperçu 100% local : musique verrouillée + images choisies (Image Lab) + un aperçu Visual Melody
// SIMPLIFIÉ pour les plans dirigés ainsi (pulsation dérivée de la forme d'onde déjà stockée, pas
// les six moteurs complets de visualmelody.netlify.app) + paroles temporaires en texte brut, non
// synchronisées. Pas d'export vidéo — juste de quoi juger le rythme avant la production (V3).

function renderAnimatiqueStep(project) {
  const an = project.animatic;
  const locked = an.locked;
  const hasAudio = !!(project.audioLocked && project.audio);
  const shots = project.storyboard.shots;

  if (!hasAudio || !shots.length) {
    return `
      <div class="page-head"><h1>Animatique</h1></div>
      <p class="page-sub">Il manque encore une brique pour assembler une timeline.</p>
      <div class="card empty-card"><div class="empty-hint">${!hasAudio ? "Verrouille l'audio (étape Audio verrouillé)" : "Génère et verrouille le storyboard"}${!hasAudio && !shots.length ? ", puis génère et verrouille le storyboard" : ""}.</div></div>
    `;
  }

  const lyricsSrc = project.sources.find((s) => s.category === "texte");
  const preloadIds = [...new Set(shots.map((sh) => (sh.images.find((im) => im.id === sh.selectedImageId) || {}).sourceId).filter(Boolean))];

  return `
    <div class="page-head">
      <h1>Animatique</h1>
      <span class="status-chip ${locked ? "" : "chip-pending"}">${locked ? "Animatique verrouillée" : "Aperçu — à valider"}</span>
    </div>
    <p class="page-sub">Assemblage local et économique de la musique verrouillée, des images choisies et d'un aperçu Visual Melody simplifié — pas les six moteurs complets de Visual Melody, juste une pulsation dérivée de la forme d'onde. Pas d'export vidéo ici : seulement de quoi juger le rythme avant la production (V3).</p>
    ${!project.imagelab.locked ? `<div class="dup-banner">ℹ️ Les images tests ne sont pas encore verrouillées — les plans sans image choisie afficheront un repère neutre.</div>` : ""}

    ${locked ? `<div class="locked-banner">🔒 Animatique verrouillée — référence pour la production.
      <button class="btn small reopen" id="reopenAnimatique">Rouvrir</button></div>` : ""}

    ${preloadIds.map((id) => `<div data-thumb="${id}" hidden></div>`).join("")}

    <div class="card animatic-card">
      <div class="animatic-stage" id="animStage">
        <div class="animatic-placeholder" id="animPlaceholder">Clique lecture pour prévisualiser l'animatique.</div>
        <canvas id="animCanvas" width="640" height="360" style="display:none"></canvas>
        <img id="animImage" alt="" style="display:none" />
        <div class="animatic-caption" id="animCaption"></div>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="play-btn" id="animPlayBtn" aria-label="Lire">▶</button>
        <div class="audio-meta"><div class="fname">${escapeHtml(project.audio.file)}</div><div class="ftag">ANIMATIQUE · ${shots.length} PLANS</div></div>
        <div class="audio-time" id="animTimeLabel">${fmtTime(0)} / ${fmtTime(project.audio.duration)}</div>
      </div>
      <div class="animatic-timeline" id="animTimeline">
        ${shots.map((sh, i) => `<i data-animseek="${sh.start}" style="flex:${Math.max(sh.dur, 0.4)}" class="${i % 2 ? "alt" : ""}"></i>`).join("")}
      </div>
      ${lyricsSrc ? `
        <button class="btn ghost" id="toggleLyrics" style="margin-top:12px">Afficher les paroles (non synchronisées)</button>
        <div class="lyrics-panel" id="lyricsPanel" hidden></div>
      ` : ""}
    </div>

    ${!locked ? `
      <div class="card decision-card">
        <div class="decision-icon">✦</div>
        <div class="decision-body">
          <h3>Verrouiller l'animatique</h3>
          <p>Le rythme et l'enchaînement des plans deviennent la référence pour la production.</p>
        </div>
        <div class="decision-actions"><button class="btn primary" id="lockAnimatique">Verrouiller l'animatique →</button></div>
      </div>
    ` : ""}
  `;
}

// ---------- Étape Production (V3.5, §8.10 — génération vidéo par plan) ----------
// Strictement limitée aux plans dont une image test est déjà choisie (jamais en masse) — chaque
// plan garde son propre panneau de génération, comme Images tests, avec le coût affiché avant
// chaque clic et un journal honnête de chaque tentative (project.videoGenerations, séparé du
// journal des images pour ne jamais mélanger les deux totaux dépensés).
const videoGenBusy = new Set();

function renderProductionStep(project) {
  const shots = project.storyboard.shots;
  const prod = project.production;
  const locked = prod.locked;
  const eligible = shots.filter((s) => s.selectedImageId);
  const readyCount = eligible.filter((s) => s.selectedVideoId).length;
  const okGens = project.videoGenerations.filter((g) => g.status === "réussi");
  const genSpend = okGens.reduce((sum, g) => sum + (g.cost || 0), 0);

  if (!shots.length) {
    return `
      <div class="page-head"><h1>Production</h1></div>
      <p class="page-sub">Aucun plan pour l'instant.</p>
      <div class="card empty-card"><div class="empty-hint">Génère le storyboard et choisis des images tests avant de produire les plans définitifs.</div></div>
    `;
  }
  if (!eligible.length) {
    return `
      <div class="page-head"><h1>Production</h1></div>
      <p class="page-sub">Aucun plan avec une image test choisie pour l'instant.</p>
      <div class="card empty-card"><div class="empty-hint">Retourne à Images tests et choisis une image de référence pour au moins un plan — la Production ne génère jamais sans image déjà validée.</div></div>
    `;
  }

  return `
    <div class="page-head">
      <h1>Production</h1>
      <span class="status-chip ${locked ? "" : "chip-pending"}">${locked ? "Production verrouillée" : `${readyCount}/${eligible.length} plan${eligible.length > 1 ? "s" : ""} avec une vidéo choisie`}</span>
    </div>
    <p class="page-sub">Génère la vidéo définitive de chaque plan approuvé — jamais en masse, un plan à la fois, sur l'image test déjà choisie. Fournisseur : ${VIDEO_GEN_PROVIDER.label}, ≈ $${VIDEO_GEN_PROVIDER.costPerSecond.toFixed(2)}/seconde de vidéo. Compare des variantes, relance ciblée en cas d'échec — les coûts réels sont journalisés séparément des images tests.</p>
    ${okGens.length ? `<p class="gen-summary">🎬 ${okGens.length} vidéo${okGens.length > 1 ? "s" : ""} générée${okGens.length > 1 ? "s" : ""} ce projet · ≈ $${genSpend.toFixed(2)} dépensés</p>` : ""}
    ${eligible.length < shots.length ? `<div class="dup-banner">ℹ️ ${shots.length - eligible.length} plan${shots.length - eligible.length > 1 ? "s n'ont" : " n'a"} pas encore d'image test choisie — ${shots.length - eligible.length > 1 ? "ils restent" : "il reste"} hors production tant que ce n'est pas fait dans Images tests.</div>` : ""}

    ${locked ? `<div class="locked-banner">🔒 Production verrouillée.
      <button class="btn small reopen" id="reopenProduction">Rouvrir</button></div>` : ""}

    ${groupShotsBySection({ ...project, storyboard: { ...project.storyboard, shots: eligible } }).map(([, sShots]) => `
      <div class="card">
        <div class="section-head"><h2>${escapeHtml(sShots[0].sectionLabel)}</h2><span class="count">${sShots.length} plan${sShots.length > 1 ? "s" : ""}</span></div>
        <div class="shot-list">
          ${sShots.map((sh, i) => renderProductionShotRow(sh, i, project, locked)).join("")}
        </div>
      </div>
    `).join("")}

    ${!locked ? `
      <div class="card decision-card">
        <div class="decision-icon">✦</div>
        <div class="decision-body">
          <h3>Verrouiller la production</h3>
          <p>Les vidéos choisies deviennent la référence pour le montage.${readyCount === 0 ? " Choisis au moins une vidéo avant de verrouiller." : ""}</p>
        </div>
        <div class="decision-actions"><button class="btn primary" id="lockProduction" ${readyCount ? "" : "disabled"}>Verrouiller la production →</button></div>
      </div>
    ` : ""}
  `;
}

function renderProductionShotRow(sh, i, project, locked) {
  const refImage = sh.images.find((im) => im.id === sh.selectedImageId);
  const refSrc = refImage ? project.sources.find((s) => s.id === refImage.sourceId) : null;
  return `
    <div class="shot-row">
      <div class="shot-top">
        <span>0${i + 1}</span><span>${fmtTime(sh.start)} · ${sh.dur.toFixed(1)}s</span>
        <span>${escapeHtml(sh.action || "(action à préciser)")}</span>
      </div>
      <div class="checklist-hint"><div><b>Image de référence :</b> ${escapeHtml(refSrc ? refSrc.name : "introuvable")}</div></div>
      <div class="image-grid">
        ${sh.videos.map((v) => renderVideoCandidate(v, sh, project, locked)).join("")}
      </div>
      ${!locked ? renderGenVideoPanel(sh, project, refImage) : ""}
    </div>
  `;
}

function renderGenVideoPanel(sh, project, refImage) {
  const promptValue = buildVideoPrompt(sh, project);
  const busy = videoGenBusy.has(sh.id);
  const lastFailed = [...project.videoGenerations].reverse().find((g) => g.shotId === sh.id && g.status === "échoué");
  const frames = videoFramesFor(sh.dur);
  const outputSec = frames / VIDEO_GEN_PROVIDER.fps;
  const clamped = outputSec < sh.dur - 0.05;
  const cost = videoCostFor(sh.dur);
  return `
    <div class="gen-panel">
      <label class="field"><span>Prompt envoyé à la génération (repris de l'image test choisie, modifiable)</span>
        <textarea data-genvideoprompt="${sh.id}" rows="2" placeholder="Décris le mouvement/l'animation souhaitée…">${escapeHtml(promptValue)}</textarea>
      </label>
      ${clamped ? `<div class="gen-error" style="color:var(--text-dim)">⚠ Vidéo limitée à ${outputSec.toFixed(1)}s (plafond du modèle à ${VIDEO_GEN_PROVIDER.fps} im/s) — le plan dure ${sh.dur.toFixed(1)}s.</div>` : ""}
      ${lastFailed && !busy ? `<div class="gen-error">⚠ Dernier essai échoué : ${escapeHtml(lastFailed.error || "erreur inconnue")}</div>` : ""}
      <div class="gen-row">
        <span class="gen-cost">≈ $${cost.toFixed(2)} / vidéo (${outputSec.toFixed(1)}s) · ${VIDEO_GEN_PROVIDER.label}</span>
        <button class="btn small" data-genvideo="${sh.id}" ${busy || !refImage ? "disabled" : ""}>${busy ? "Génération en cours (peut prendre 1-2 min)…" : "🎬 Générer la vidéo"}</button>
      </div>
    </div>
  `;
}

function renderVideoCandidate(v, sh, project, locked) {
  const src = project.sources.find((s) => s.id === v.sourceId);
  const isSelected = sh.selectedVideoId === v.id;
  const url = src ? (videoUrlCache.get(v.sourceId) || null) : null;
  return `
    <div class="image-card ${isSelected ? "selected" : ""}">
      <div class="image-thumb video-thumb" data-videothumb="${v.sourceId}">${url ? `<video src="${url}" controls preload="metadata"></video>` : `<span class="empty-hint" style="font-size:11px">chargement…</span>`}</div>
      <div class="image-card-body">
        <div class="image-card-name"><span class="name-text">${escapeHtml(src ? src.name : "Vidéo introuvable")}</span><span class="gen-badge">IA</span></div>
        ${!locked ? `
          <div class="image-card-actions">
            <button class="btn small ${isSelected ? "primary" : ""}" data-selectvideo="${sh.id}:${v.id}">${isSelected ? "✓ Choisie" : "Choisir"}</button>
            <button class="src-del" data-delvideo="${sh.id}:${v.id}" aria-label="Retirer">✕</button>
          </div>
        ` : isSelected ? `<div class="image-card-actions"><span class="status-chip small">✓ Choisie</span></div>` : ""}
      </div>
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
        <div class="src-name"><span class="name-text">${escapeHtml(s.name)}</span>${s.dup ? '<span class="dup-badge">doublon</span>' : ""}${s.generated ? '<span class="gen-badge">IA</span>' : ""}</div>
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
  let loadedAny = false;
  for (const el of targets) {
    const id = el.dataset.thumb;
    if (imageUrlCache.has(id)) continue;
    try {
      const blob = await AiXelDB.getBlob(id);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      imageUrlCache.set(id, url);
      el.innerHTML = `<img src="${url}" alt="" />`;
      loadedAny = true;
    } catch {}
  }
  // Les vignettes de l'animatique se chargent en arrière-plan (data-thumb caché) — une fois prêtes,
  // on redessine la scène pour ne pas rester bloqué sur le repère neutre.
  if (loadedAny && project && project.activeStepId === "animatique" && project.audio) {
    updateAnimaticStage(project, audioEl && audioElKey === audioKeyFor(project) ? audioEl.currentTime : 0);
  }
}

async function loadVideoThumbnails(project) {
  const targets = document.querySelectorAll("[data-videothumb]");
  for (const el of targets) {
    const id = el.dataset.videothumb;
    if (videoUrlCache.has(id)) { if (!el.querySelector("video")) el.innerHTML = `<video src="${videoUrlCache.get(id)}" controls preload="metadata"></video>`; continue; }
    try {
      const blob = await AiXelDB.getBlob(id);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      videoUrlCache.set(id, url);
      el.innerHTML = `<video src="${url}" controls preload="metadata"></video>`;
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
        <div class="metric"><b>${Math.round(project.audio.bpm)}</b><small>${project.audio.bpmManual ? "BPM (corrigé)" : "BPM estimé"}</small></div>
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
  const wantsPlayback = project && (project.activeStepId === "carte" || project.activeStepId === "animatique") && project.audio;
  if (audioEl && (!wantsPlayback || audioElKey !== key)) audioEl.pause();
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

  const animTimeLabel = document.getElementById("animTimeLabel");
  const animPlayBtn = document.getElementById("animPlayBtn");
  if (animTimeLabel) animTimeLabel.textContent = `${fmtTime(audioEl.currentTime || 0)} / ${fmtTime(audioEl.duration || 0)}`;
  if (animPlayBtn) animPlayBtn.textContent = audioEl.paused ? "▶" : "⏸";
  if (animTimeLabel || animPlayBtn) updateAnimaticStage(currentProject(), audioEl.currentTime || 0);
}

// ---------- Animatique : plan courant, pulsation Visual Melody simplifiée, paroles ----------

function currentShotAt(project, t) {
  const shots = project.storyboard.shots;
  for (let i = shots.length - 1; i >= 0; i--) {
    if (t >= shots[i].start) return shots[i];
  }
  return shots[0] || null;
}

function updateAnimaticStage(project, t) {
  if (!project || !project.audio) return;
  const shot = currentShotAt(project, t);
  const placeholder = document.getElementById("animPlaceholder");
  const canvas = document.getElementById("animCanvas");
  const imgEl = document.getElementById("animImage");
  const caption = document.getElementById("animCaption");
  const timeline = document.getElementById("animTimeline");
  if (!placeholder || !canvas || !imgEl || !caption) return;
  if (!shot) return;

  const captionBits = [shot.sectionLabel, shot.action || shot.emotion || ""].filter(Boolean);
  if (shot.direction === "visualmelody") captionBits.push("Visual Melody (aperçu simplifié)");
  caption.textContent = captionBits.join(" — ");
  const selImg = shot.images.find((im) => im.id === shot.selectedImageId);

  if (shot.direction === "visualmelody") {
    placeholder.style.display = "none";
    canvas.style.display = "block";
    imgEl.style.display = "none";
    drawVisualMelodyPulse(project, canvas, t);
  } else if (selImg && imageUrlCache.get(selImg.sourceId)) {
    placeholder.style.display = "none";
    canvas.style.display = "none";
    imgEl.style.display = "block";
    const url = imageUrlCache.get(selImg.sourceId);
    if (imgEl.dataset.cur !== url) { imgEl.src = url; imgEl.dataset.cur = url; }
  } else {
    canvas.style.display = "none";
    imgEl.style.display = "none";
    placeholder.style.display = "flex";
    placeholder.textContent = "Aucune image sélectionnée pour ce plan.";
  }

  if (timeline && project.audio.duration) {
    const ratio = Math.min(1, Math.max(0, t / project.audio.duration));
    timeline.style.setProperty("--playhead", `${ratio * 100}%`);
  }
}

function drawVisualMelodyPulse(project, canvas, t) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#05070c";
  ctx.fillRect(0, 0, w, h);
  const wave = project.audio.waveform && project.audio.waveform.length ? project.audio.waveform : WAVE;
  const dur = project.audio.duration || 1;
  const ratio = Math.min(1, Math.max(0, t / dur));
  const idx = Math.min(wave.length - 1, Math.floor(ratio * wave.length));
  const level = wave[idx] || 0.3;
  const cx = w / 2, cy = h / 2;
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(w, h) / 2);
  grad.addColorStop(0, "rgba(63,214,245,.9)");
  grad.addColorStop(0.5, "rgba(242,111,208,.45)");
  grad.addColorStop(1, "rgba(5,7,12,0)");
  ctx.fillStyle = grad;
  const radius = Math.max(24, 30 + level * (Math.min(w, h) / 2 - 20));
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(232,185,92,.35)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(10, radius - i * 18), 0, Math.PI * 2);
    ctx.stroke();
  }
}

const lyricsTextCache = new Map();
async function getLyricsText(source) {
  if (lyricsTextCache.has(source.id)) return lyricsTextCache.get(source.id);
  const blob = await AiXelDB.getBlob(source.id);
  if (!blob) throw new Error("introuvable");
  const looksPlain = source.mime === "text/plain" || /\.(txt|md)$/i.test(source.name);
  if (!looksPlain) throw new Error("format non pris en charge");
  const text = await blob.text();
  lyricsTextCache.set(source.id, text);
  return text;
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
  document.querySelectorAll("[data-delete]").forEach((el) => el.addEventListener("click", (e) => {
    e.stopPropagation();
    state.ui.confirmDeleteId = el.dataset.delete;
    render();
  }));

  document.querySelectorAll(".step").forEach((el) => el.addEventListener("click", () => {
    project.activeStepId = el.dataset.step; persist(); render();
  }));

  bindNewProjectModal();
  bindDeleteProjectModal();
  bindSourcesStep(project);
  bindAudioStep(project);
  bindBriefStep(project);
  bindBiblesStep(project);
  bindHistoireStep(project);
  bindStoryboardStep(project);
  bindImagesStep(project);
  bindAnimatiqueStep(project);
  bindProductionStep(project);

  if (project.activeStepId === "carte" && project.audio) {
    bindCarteMusicaleAudio(project);
  }
  if ((project.activeStepId === "carte" || project.activeStepId === "animatique") && project.audio) {
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
    project.activeStepId = "animatique";
    persist(); render();
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
        bpmManual: false,
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
  document.getElementById("bpmOverride")?.addEventListener("change", (e) => {
    const v = parseFloat(e.target.value);
    if (!Number.isFinite(v) || v <= 0) return;
    project.audio.bpm = v;
    project.audio.bpmManual = true;
    touch(project); persist(); render();
    toast("BPM corrigé manuellement.");
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
  document.getElementById("replaceAudioBtn")?.addEventListener("click", () => {
    document.getElementById("replaceAudioInput")?.click();
  });
  document.getElementById("replaceAudioInput")?.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    await replaceAudioFile(project, file);
  });
}

async function replaceAudioFile(project, file) {
  const audioSrc = project.sources.find((s) => s.category === "audio");
  if (!audioSrc) { toast("Aucune source audio à remplacer — passe par l'étape Sources."); return; }
  const looksAudio = (file.type && file.type.startsWith("audio/")) || /\.(mp3|wav|m4a|aac|flac|ogg|aiff?)$/i.test(file.name);
  if (!looksAudio) { toast("Ce fichier ne ressemble pas à un fichier audio."); return; }
  toast("Remplacement en cours…");
  try {
    await AiXelDB.putBlob(audioSrc.id, file);
    audioSrc.name = file.name;
    audioSrc.size = file.size;
    audioSrc.mime = file.type || audioSrc.mime;
    audioSrc.addedAt = Date.now();
    // La lecture audio (étapes Carte musicale / Animatique) met en cache un <audio>
    // par sourceId : on l'invalide pour forcer un rechargement du nouveau fichier.
    if (audioEl) { audioEl.pause(); audioEl.remove(); audioEl = null; audioElKey = null; }
    const result = await AiXelAudio.analyze(file);
    const prevBpmManual = project.audio && project.audio.bpmManual;
    const prevBpm = project.audio && project.audio.bpm;
    project.audio = {
      sourceId: audioSrc.id,
      file: audioSrc.name,
      duration: result.duration,
      bpm: prevBpmManual ? prevBpm : result.bpm,
      peak: result.peak,
      profile: profileFromEnergy(result.averageEnergy),
      waveform: result.waveform,
      bpmManual: !!prevBpmManual,
    };
    // Volontairement inchangés : project.structure et project.storyboard.shots —
    // ton découpage en sections et tes plans (actions/décors/caméra/images choisies)
    // restent exactement comme tu les as laissés.
    touch(project); persist(); render();
    toast(`Audio remplacé — nouvelle durée ${fmtTime(result.duration)}. Sections et plans conservés.`);
  } catch (err) {
    console.error(err);
    toast(err.message || "Échec du remplacement audio.");
  }
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
  const bulkInput = document.getElementById("bulkShotsInput");
  if (bulkInput) {
    bulkInput.addEventListener("dragover", (e) => { e.preventDefault(); bulkInput.classList.add("drag-over"); });
    bulkInput.addEventListener("dragleave", () => { bulkInput.classList.remove("drag-over"); });
    bulkInput.addEventListener("drop", async (e) => {
      e.preventDefault();
      bulkInput.classList.remove("drag-over");
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      const looksTexty = /\.(md|markdown|txt)$/i.test(file.name) || (file.type && file.type.startsWith("text/")) || !file.type;
      if (!looksTexty) { toast("Dépose un fichier texte (.md ou .txt)."); return; }
      try {
        const text = await file.text();
        bulkInput.value = text;
        toast(`« ${file.name} » chargé — clique sur "Importer dans les plans →".`);
      } catch {
        toast("Impossible de lire ce fichier.");
      }
    });
  }
  document.getElementById("bulkShotsApply")?.addEventListener("click", () => {
    const ta = document.getElementById("bulkShotsInput");
    const blocks = ta ? parseBulkShotBlocks(ta.value) : [];
    if (!blocks.length) { toast("Aucun plan reconnu — vérifie le format (Action :/Décor :/Caméra :/Émotion :)."); return; }
    const n = Math.min(blocks.length, sb.shots.length);
    for (let i = 0; i < n; i++) {
      const b = blocks[i], s = sb.shots[i];
      if (b.action != null) s.action = b.action;
      if (b.decor != null) s.decor = b.decor;
      if (b.camera != null) s.camera = b.camera;
      if (b.emotion != null) s.emotion = b.emotion;
    }
    touch(project); persist(); render();
    toast(blocks.length === sb.shots.length ? `${n} plans importés.` : `${n} plan${n > 1 ? "s" : ""} importé${n > 1 ? "s" : ""} sur ${sb.shots.length} (texte collé = ${blocks.length} bloc${blocks.length > 1 ? "s" : ""}).`);
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

function bindImagesStep(project) {
  const findShot = (id) => project.storyboard.shots.find((s) => s.id === id);
  const findImage = (id) => project.storyboard.shots.flatMap((s) => s.images).find((im) => im.id === id);

  document.querySelectorAll(".image-thumb[data-thumb]").forEach((el) => el.addEventListener("click", () => {
    const url = imageUrlCache.get(el.dataset.thumb);
    if (url) { state.ui.lightboxSrc = url; render(); }
  }));
  document.getElementById("lightboxBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "lightboxBackdrop" || e.target.id === "lightboxClose") { state.ui.lightboxSrc = null; render(); }
  });
  document.querySelectorAll("[data-addimage]").forEach((btn) => btn.addEventListener("click", () => {
    const shotId = btn.dataset.addimage;
    const sh = findShot(shotId);
    const select = document.querySelector(`[data-imgsrcpick="${shotId}"]`);
    if (!sh || !select || !select.value) return;
    sh.images.push(defaultShotImage(select.value));
    touch(project); persist(); render();
  }));
  document.querySelectorAll("[data-imagestatus]").forEach((el) => el.addEventListener("change", () => {
    const im = findImage(el.dataset.imagestatus);
    if (im) { im.status = el.value; touch(project); persist(); }
  }));
  document.querySelectorAll("[data-imagecheck]").forEach((el) => el.addEventListener("change", () => {
    const [imId, key] = el.dataset.imagecheck.split(":");
    const im = findImage(imId);
    if (im) { im.checks[key] = el.value; touch(project); persist(); }
  }));
  document.querySelectorAll("[data-imagenotes]").forEach((el) => el.addEventListener("change", () => {
    const im = findImage(el.dataset.imagenotes);
    if (im) { im.notes = el.value; touch(project); persist(); }
  }));
  document.querySelectorAll("[data-selectimage]").forEach((btn) => btn.addEventListener("click", () => {
    const [shotId, imId] = btn.dataset.selectimage.split(":");
    const sh = findShot(shotId);
    if (sh) { sh.selectedImageId = sh.selectedImageId === imId ? null : imId; touch(project); persist(); render(); }
  }));
  document.querySelectorAll("[data-delimage]").forEach((btn) => btn.addEventListener("click", () => {
    const [shotId, imId] = btn.dataset.delimage.split(":");
    const sh = findShot(shotId);
    if (sh) {
      sh.images = sh.images.filter((im) => im.id !== imId);
      if (sh.selectedImageId === imId) sh.selectedImageId = null;
      touch(project); persist(); render();
    }
  }));
  document.querySelectorAll("[data-genprompt]").forEach((el) => el.addEventListener("change", () => {
    const sh = findShot(el.dataset.genprompt);
    if (sh) { sh.genPrompt = el.value; touch(project); persist(); }
  }));
  document.querySelectorAll("[data-genimage]").forEach((btn) => btn.addEventListener("click", async () => {
    const shotId = btn.dataset.genimage;
    const sh = findShot(shotId);
    if (!sh || genBusy.has(shotId)) return;
    const promptEl = document.querySelector(`[data-genprompt="${shotId}"]`);
    const prompt = (promptEl && promptEl.value.trim()) || buildImagePrompt(sh, project);
    if (!prompt) { toast("Rien à générer — précise une action, un décor ou un prompt pour ce plan."); return; }
    genBusy.add(shotId);
    btn.disabled = true;
    btn.textContent = "Génération en cours…";
    try {
      const { blob, cost } = await runImageGeneration(prompt, buildNegativePrompt(sh, project));
      const srcId = uid();
      project.sources.push({
        id: srcId, name: `généré_${shotId.slice(0, 6)}_${Date.now().toString(36).slice(-4)}.png`,
        size: blob.size, mime: blob.type || "image/png", category: "image", role: "Livrable",
        addedAt: Date.now(), generated: true,
      });
      await AiXelDB.putBlob(srcId, blob);
      sh.images.push(defaultShotImage(srcId));
      project.generations.push({ id: uid(), shotId, provider: GEN_PROVIDER.id, model: GEN_PROVIDER.label, prompt, cost, status: "réussi", createdAt: Date.now(), sourceId: srcId });
      touch(project); persist();
      toast("Image générée — ajoutée aux candidats de ce plan.");
    } catch (err) {
      console.error(err);
      project.generations.push({ id: uid(), shotId, provider: GEN_PROVIDER.id, model: GEN_PROVIDER.label, prompt, cost: 0, status: "échoué", error: err.message, createdAt: Date.now() });
      touch(project); persist();
      toast(err.message || "Échec de la génération.");
    }
    genBusy.delete(shotId);
    render();
  }));
  document.getElementById("lockImages")?.addEventListener("click", () => {
    if (!project.storyboard.shots.some((s) => s.selectedImageId)) return;
    project.imagelab.locked = true; project.imagelab.lockedAt = Date.now();
    const step = project.steps.find((s) => s.id === "images"); if (step) step.status = "done";
    const next = project.steps.find((s) => s.id === "animatique"); if (next && next.status === "pending") next.status = "active";
    if (next) project.activeStepId = next.id;
    touch(project); persist(); render();
    toast("Images tests verrouillées.");
  });
  document.getElementById("reopenImages")?.addEventListener("click", () => {
    project.imagelab.locked = false;
    const step = project.steps.find((s) => s.id === "images"); if (step) step.status = "active";
    const next = project.steps.find((s) => s.id === "animatique"); if (next && next.status === "active") next.status = "pending";
    touch(project); persist(); render();
  });
}

function bindAnimatiqueStep(project) {
  const playBtn = document.getElementById("animPlayBtn");
  const timeline = document.getElementById("animTimeline");
  if (playBtn) playBtn.addEventListener("click", async () => {
    playBtn.disabled = true;
    try {
      const el = await loadAudioEl(project);
      if (!el) { toast("Fichier audio introuvable localement."); return; }
      if (el.paused) await el.play(); else el.pause();
    } catch { toast("Lecture impossible."); }
    playBtn.disabled = false;
  });
  if (timeline) timeline.addEventListener("click", async (e) => {
    const target = e.target.closest("[data-animseek]");
    if (!target) return;
    const el = await loadAudioEl(project);
    if (!el) return;
    const seekTo = parseFloat(target.dataset.animseek);
    const setTime = () => { el.currentTime = seekTo; syncAudioUI(); };
    if (el.readyState >= 1) setTime(); else el.addEventListener("loadedmetadata", setTime, { once: true });
  });
  document.getElementById("toggleLyrics")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const panel = document.getElementById("lyricsPanel");
    if (!panel) return;
    if (!panel.hidden) { panel.hidden = true; btn.textContent = "Afficher les paroles (non synchronisées)"; return; }
    const lyricsSrc = project.sources.find((s) => s.category === "texte");
    if (!lyricsSrc) return;
    panel.hidden = false;
    panel.textContent = "Chargement…";
    btn.textContent = "Masquer les paroles";
    try {
      panel.textContent = await getLyricsText(lyricsSrc);
    } catch {
      panel.textContent = "Texte introuvable ou format non pris en charge (pdf/docx) — importe une version .txt pour l'afficher ici.";
    }
  });
  document.getElementById("lockAnimatique")?.addEventListener("click", () => {
    project.animatic.locked = true; project.animatic.lockedAt = Date.now();
    const step = project.steps.find((s) => s.id === "animatique"); if (step) step.status = "done";
    const next = project.steps.find((s) => s.id === "production"); if (next && next.status === "pending") next.status = "active";
    if (next) project.activeStepId = next.id;
    touch(project); persist(); render();
    toast("Animatique verrouillée.");
  });
  document.getElementById("reopenAnimatique")?.addEventListener("click", () => {
    project.animatic.locked = false;
    const step = project.steps.find((s) => s.id === "animatique"); if (step) step.status = "active";
    const next = project.steps.find((s) => s.id === "production"); if (next && next.status === "active") next.status = "pending";
    touch(project); persist(); render();
  });
  if (project.audio && project.storyboard.shots.length) updateAnimaticStage(project, 0);
}

function bindProductionStep(project) {
  const findShot = (id) => project.storyboard.shots.find((s) => s.id === id);

  document.querySelectorAll("[data-genvideoprompt]").forEach((el) => el.addEventListener("change", () => {
    const sh = findShot(el.dataset.genvideoprompt);
    if (sh) { sh.genVideoPrompt = el.value; touch(project); persist(); }
  }));
  document.querySelectorAll("[data-selectvideo]").forEach((btn) => btn.addEventListener("click", () => {
    const [shotId, vId] = btn.dataset.selectvideo.split(":");
    const sh = findShot(shotId);
    if (sh) { sh.selectedVideoId = sh.selectedVideoId === vId ? null : vId; touch(project); persist(); render(); }
  }));
  document.querySelectorAll("[data-delvideo]").forEach((btn) => btn.addEventListener("click", () => {
    const [shotId, vId] = btn.dataset.delvideo.split(":");
    const sh = findShot(shotId);
    if (sh) {
      const v = sh.videos.find((x) => x.id === vId);
      if (v && videoUrlCache.has(v.sourceId)) { URL.revokeObjectURL(videoUrlCache.get(v.sourceId)); videoUrlCache.delete(v.sourceId); }
      sh.videos = sh.videos.filter((x) => x.id !== vId);
      if (sh.selectedVideoId === vId) sh.selectedVideoId = null;
      touch(project); persist(); render();
    }
  }));
  document.querySelectorAll("[data-genvideo]").forEach((btn) => btn.addEventListener("click", async () => {
    const shotId = btn.dataset.genvideo;
    const sh = findShot(shotId);
    if (!sh || videoGenBusy.has(shotId)) return;
    const refImage = sh.images.find((im) => im.id === sh.selectedImageId);
    if (!refImage) { toast("Choisis d'abord une image test pour ce plan (étape Images tests)."); return; }
    const promptEl = document.querySelector(`[data-genvideoprompt="${shotId}"]`);
    const prompt = (promptEl && promptEl.value.trim()) || buildVideoPrompt(sh, project);
    if (!prompt) { toast("Rien à générer — précise une action ou un prompt pour ce plan."); return; }
    videoGenBusy.add(shotId);
    btn.disabled = true;
    btn.textContent = "Génération en cours (peut prendre 1-2 min)…";
    try {
      const refBlob = await AiXelDB.getBlob(refImage.sourceId);
      if (!refBlob) throw new Error("Image de référence introuvable localement.");
      const { blob, cost } = await runVideoGeneration(prompt, refBlob, sh.dur);
      const srcId = uid();
      project.sources.push({
        id: srcId, name: `vidéo_${shotId.slice(0, 6)}_${Date.now().toString(36).slice(-4)}.mp4`,
        size: blob.size, mime: blob.type || "video/mp4", category: "video", role: "Livrable",
        addedAt: Date.now(), generated: true,
      });
      await AiXelDB.putBlob(srcId, blob);
      sh.videos.push(defaultShotVideo(srcId));
      project.videoGenerations.push({ id: uid(), shotId, provider: VIDEO_GEN_PROVIDER.id, model: VIDEO_GEN_PROVIDER.label, prompt, cost, status: "réussi", createdAt: Date.now(), sourceId: srcId });
      touch(project); persist();
      toast("Vidéo générée — ajoutée aux candidats de ce plan.");
    } catch (err) {
      console.error(err);
      project.videoGenerations.push({ id: uid(), shotId, provider: VIDEO_GEN_PROVIDER.id, model: VIDEO_GEN_PROVIDER.label, prompt, cost: 0, status: "échoué", error: err.message, createdAt: Date.now() });
      touch(project); persist();
      toast(err.message || "Échec de la génération vidéo.");
    }
    videoGenBusy.delete(shotId);
    render();
  }));
  document.getElementById("lockProduction")?.addEventListener("click", () => {
    if (!project.storyboard.shots.some((s) => s.selectedVideoId)) return;
    project.production.locked = true; project.production.lockedAt = Date.now();
    const step = project.steps.find((s) => s.id === "production"); if (step) step.status = "done";
    touch(project); persist(); render();
    toast("Production verrouillée.");
  });
  document.getElementById("reopenProduction")?.addEventListener("click", () => {
    project.production.locked = false;
    const step = project.steps.find((s) => s.id === "production"); if (step) step.status = "active";
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
