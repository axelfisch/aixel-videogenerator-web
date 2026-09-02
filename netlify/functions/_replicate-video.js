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
// Correctif du 2026-09-02 : le schéma d'entrée réel de ce modèle (vérifié en direct sur
// replicate.com/wavespeedai/wan-2.1-i2v-480p/api/schema) n'a PLUS de champ `num_frames` ni
// `max_area` — seuls image/prompt/aspect_ratio (+ réglages avancés) existent désormais. Le
// connecteur initial envoyait ces deux champs disparus, ce qui faisait échouer le wrapper
// d'inférence accéléré de WaveSpeedAI à chaque appel (erreur générique "(E002)", même trace ID à
// chaque fois, quels que soient l'image ou le plan — bug réel rencontré par Axel, diagnostiqué en
// reproduisant l'appel directement contre le site déployé). La durée de sortie n'est donc plus
// réglable : elle est fixe côté fournisseur, ~5,0625s (81 images à 16 im/s — confirmé sur un
// exemple public du modèle), d'où un coût fixe lui aussi.
const FIXED_OUTPUT_FRAMES = 81;
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

// Le résultat d'une prédiction réussie est une URL Replicate temporaire. Contrairement au
// connecteur image (V3), on NE rapatrie PAS la vidéo en base64 côté serveur : les fonctions
// Netlify (AWS Lambda dessous) refusent toute réponse synchrone au-delà de ~6 Mo, et une vidéo
// (même courte, même en 480p) dépasse vite cette limite une fois encodée en base64 (+33%) — bug
// réel rencontré par Axel le 2026-09-02 (erreur générique de la plateforme, avant même que ce
// code ne s'exécute). On renvoie donc directement l'URL Replicate : le client la télécharge
// lui-même pour la stocker localement (IndexedDB). Cette URL est temporaire et sans donnée
// sensible (contrairement au jeton API, qui lui ne quitte jamais ce fichier) — l'exposer au
// navigateur juste le temps d'un téléchargement immédiat ne pose pas de problème.
function normalizeSucceeded(prediction) {
  const output = prediction.output;
  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error("La génération a réussi mais n'a renvoyé aucune vidéo.");
  const cost = (FIXED_OUTPUT_FRAMES / FPS) * COST_PER_SECOND_USD;
  return { status: "succeeded", videoUrl: url, cost, id: prediction.id };
}

function normalizePending(prediction) {
  return { status: "processing", id: prediction.id };
}

function normalizeFailed(prediction) {
  return { status: "failed", error: (prediction && prediction.error) || "Génération vidéo échouée côté fournisseur." };
}

module.exports = { MODEL, API_BASE, FPS, FIXED_OUTPUT_FRAMES, COST_PER_SECOND_USD, requireToken, normalizeSucceeded, normalizePending, normalizeFailed };
