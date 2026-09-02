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

// Correctif du 2026-09-02, tentative 1 (abandonnée) : l'URL Replicate renvoyée par une prédiction
// réussie n'envoie pas d'en-têtes CORS permissifs — un `fetch()` direct depuis le navigateur
// échoue silencieusement ("Failed to fetch"), confirmé en le testant en direct. Un premier
// correctif rapatriait la vidéo en base64 CÔTÉ SERVEUR (comme pour les images, §V3), mais la
// taille d'une vidéo dépasse parfois la limite de réponse synchrone des fonctions Netlify (~6 Mo)
// selon la scène — pas un cas rare, une vraie génération réelle l'a déclenché.
//
// Correctif du 2026-09-02, définitif : réécriture proxy dans netlify.toml
// (`/video-proxy/* → https://replicate.delivery/:splat`, status 200). Le CDN Netlify lui-même
// relaie l'octet-stream — même origine pour le navigateur (donc pas de CORS), aucune fonction
// Lambda dans la boucle (donc pas de plafond de 6 Mo). On transforme donc simplement l'URL
// Replicate en chemin relatif vers ce proxy plutôt que de rapatrier quoi que ce soit ici.
function toProxiedVideoUrl(replicateUrl) {
  const marker = "replicate.delivery/";
  const idx = replicateUrl.indexOf(marker);
  if (idx === -1) return replicateUrl; // filet de sécurité si jamais le domaine change un jour
  return "/video-proxy/" + replicateUrl.slice(idx + marker.length);
}

function normalizeSucceeded(prediction) {
  const output = prediction.output;
  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error("La génération a réussi mais n'a renvoyé aucune vidéo.");
  return { status: "succeeded", videoUrl: toProxiedVideoUrl(url), cost: FIXED_COST_USD_480P, id: prediction.id };
}

function normalizePending(prediction) {
  return { status: "processing", id: prediction.id };
}

function normalizeFailed(prediction) {
  return { status: "failed", error: (prediction && prediction.error) || "Génération vidéo échouée côté fournisseur." };
}

module.exports = { MODEL, API_BASE, FPS, OUTPUT_FRAMES, FIXED_COST_USD_480P, requireToken, toProxiedVideoUrl, normalizeSucceeded, normalizePending, normalizeFailed };
