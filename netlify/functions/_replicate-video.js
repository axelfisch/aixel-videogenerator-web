// Connecteur vidéo (V3.5, §8.10 Production Router) — proxy commun à generate-video.js et
// generate-video-status.js. Isolé ici pour que changer de fournisseur ne touche que ce fichier.
//
// La clé API (REPLICATE_API_TOKEN) — la même que pour les images tests (V3) — ne vit QUE dans les
// variables d'environnement Netlify, jamais dans ce code, jamais envoyée au navigateur.

// Correctif du 2026-09-02 (bug "(E002) (1cah9wlWR9)") : `wavespeedai/wan-2.1-i2v-480p` a d'abord
// semblé en cause à cause d'un schéma d'entrée obsolète dans ce connecteur (num_frames/max_area
// disparus, remplacés par aspect_ratio — voir historique git). Une fois ce correctif déployé et
// vérifié en direct (payload exactement conforme au schéma actuel, Replicate acceptant la
// prédiction avec un HTTP 201), l'échec persistait IDENTIQUE — preuve que le problème est en
// réalité côté fournisseur pour CE modèle précis (wrapper d'inférence accéléré WaveSpeedAI),
// indépendamment de notre code. Bascule donc sur `wan-video/wan-2.2-i2v-a14b`, un modèle Wan 2.2
// équivalent mais hébergé par un fournisseur d'inférence différent (Pruna AI) — même famille de
// modèle, autre infrastructure d'exécution. À reconsidérer si ce nouveau modèle montre lui aussi
// des soucis, ou si WaveSpeedAI confirme avoir résolu son incident (auquel cas comparer qualité et
// coût des deux avant de choisir définitivement).
const MODEL = "wan-video/wan-2.2-i2v-a14b";
const API_BASE = "https://api.replicate.com/v1";
const FPS = 16;
const OUTPUT_FRAMES = 81; // min/défaut du modèle — 81 images à 16 im/s ⇒ ~5,0625s de sortie
// Tarif Replicate au 2026-09 (à réviser si le fournisseur change ses prix) — prix fixe par vidéo
// (pas au temps) pour ce modèle : $0,40 en 480p, $1 en 720p (source : page pricing du modèle sur
// replicate.com/wan-video/wan-2.2-i2v-a14b).
const FIXED_COST_USD_480P = 0.40;

function requireToken() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    const err = new Error(
      "Clé API Replicate non configurée côté serveur (variable d'environnement REPLICATE_API_TOKEN manquante dans les réglages Netlify de ce site)."
    );
    err.status = 500;
    throw err;
  }
  return token;
}

// Correctif du 2026-09-02 : l'URL Replicate renvoyée par une prédiction réussie n'envoie PAS
// d'en-têtes CORS permissifs — un `fetch()` direct depuis le navigateur échoue silencieusement
// ("Failed to fetch", aucun détail exploitable), confirmé en le testant en direct depuis le site
// déployé. Un `<video>`/`<img>` peut charger cette URL sans CORS, mais pas `fetch()`, qui est ce
// dont on a besoin pour récupérer les octets et les stocker dans IndexedDB. On rapatrie donc la
// vidéo en base64 CÔTÉ SERVEUR (même principe que le connecteur image, §V3, où ça fonctionne de
// façon fiable depuis le début) plutôt que de renvoyer l'URL nue au client. Une vidéo 480p de
// ~5s tient largement sous la limite de réponse synchrone des fonctions Netlify (~6 Mo) ; par
// sécurité, on refuse proprement plutôt que de risquer une réponse tronquée si jamais ça ne tenait
// pas (garde-fou à 4,5 Mo en base64, même seuil que côté image d'entrée dans app.js).
async function fetchVideoAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Vidéo générée introuvable au moment de la récupérer (lien peut-être expiré) — réessaie.");
  const buf = Buffer.from(await res.arrayBuffer());
  const base64 = buf.toString("base64");
  if (base64.length > 4.5 * 1024 * 1024) {
    throw new Error("La vidéo générée est trop volumineuse pour être rapatriée automatiquement (cas rare) — réessaie, ou signale-le si ça se reproduit.");
  }
  const mime = res.headers.get("content-type") || "video/mp4";
  return { videoBase64: base64, mime };
}

async function normalizeSucceeded(prediction) {
  const output = prediction.output;
  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error("La génération a réussi mais n'a renvoyé aucune vidéo.");
  const { videoBase64, mime } = await fetchVideoAsBase64(url);
  return { status: "succeeded", videoBase64, mime, cost: FIXED_COST_USD_480P, id: prediction.id };
}

function normalizePending(prediction) {
  return { status: "processing", id: prediction.id };
}

function normalizeFailed(prediction) {
  return { status: "failed", error: (prediction && prediction.error) || "Génération vidéo échouée côté fournisseur." };
}

module.exports = { MODEL, API_BASE, FPS, OUTPUT_FRAMES, FIXED_COST_USD_480P, requireToken, fetchVideoAsBase64, normalizeSucceeded, normalizePending, normalizeFailed };
