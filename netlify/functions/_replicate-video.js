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

// Le résultat d'une prédiction réussie est une URL Replicate temporaire. Contrairement au
// connecteur image (V3), on NE rapatrie PAS la vidéo en base64 côté serveur : les fonctions
// Netlify (AWS Lambda dessous) refusent toute réponse synchrone au-delà de ~6 Mo, et une vidéo
// (même courte, même en 480p) dépasse vite cette limite une fois encodée en base64 (+33%). On
// renvoie donc directement l'URL Replicate : le client la télécharge lui-même pour la stocker
// localement (IndexedDB). Cette URL est temporaire et sans donnée sensible (contrairement au
// jeton API, qui lui ne quitte jamais ce fichier).
function normalizeSucceeded(prediction) {
  const output = prediction.output;
  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error("La génération a réussi mais n'a renvoyé aucune vidéo.");
  return { status: "succeeded", videoUrl: url, cost: FIXED_COST_USD_480P, id: prediction.id };
}

function normalizePending(prediction) {
  return { status: "processing", id: prediction.id };
}

function normalizeFailed(prediction) {
  return { status: "failed", error: (prediction && prediction.error) || "Génération vidéo échouée côté fournisseur." };
}

module.exports = { MODEL, API_BASE, FPS, OUTPUT_FRAMES, FIXED_COST_USD_480P, requireToken, normalizeSucceeded, normalizePending, normalizeFailed };
