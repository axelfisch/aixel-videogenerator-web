// Connecteur vidéo (V3.5, §8.10 Production Router) — proxy commun à generate-video.js et
// generate-video-status.js. Fournisseur : Replicate, modèle Wan 2.1 image→vidéo (480p), isolé ici
// pour que changer de fournisseur plus tard (ex. TokenRouter, une fois son contrat d'API vidéo
// publiquement confirmé — voir README §"Prochaine étape") ne touche que ce fichier (§10).
//
// La clé API (REPLICATE_API_TOKEN) — la même que pour les images tests (V3) — ne vit QUE dans les
// variables d'environnement Netlify, jamais dans ce code, jamais envoyée au navigateur.

const MODEL = "wavespeedai/wan-2.1-i2v-480p";
const API_BASE = "https://api.replicate.com/v1";
const FPS = 16;
// Tarif Replicate au 2026-09 (à réviser si le fournisseur change ses prix) — $0,09/seconde de
// sortie en 480p (source : replicate.com/pricing, modèles Wan 2.1 i2v).
const COST_PER_SECOND_USD = 0.09;

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

// Le résultat d'une prédiction réussie est une URL Replicate temporaire — on rapatrie la vidéo
// tout de suite côté serveur pour ne jamais exposer cette URL (ni sa durée de vie limitée) au
// navigateur : le client reçoit directement les octets à stocker localement (IndexedDB).
async function fetchAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Vidéo générée introuvable au moment de la récupérer.");
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") || "video/mp4";
  return { videoBase64: buf.toString("base64"), mime };
}

async function normalizeSucceeded(prediction, frames) {
  const output = prediction.output;
  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error("La génération a réussi mais n'a renvoyé aucune vidéo.");
  const { videoBase64, mime } = await fetchAsBase64(url);
  const cost = (frames / FPS) * COST_PER_SECOND_USD;
  return { status: "succeeded", videoBase64, mime, cost, id: prediction.id };
}

function normalizePending(prediction) {
  return { status: "processing", id: prediction.id };
}

function normalizeFailed(prediction) {
  return { status: "failed", error: (prediction && prediction.error) || "Génération vidéo échouée côté fournisseur." };
}

module.exports = { MODEL, API_BASE, FPS, COST_PER_SECOND_USD, requireToken, fetchAsBase64, normalizeSucceeded, normalizePending, normalizeFailed };
