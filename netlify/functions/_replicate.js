// Connecteur de génération d'images (V3, §8.10 Production Router) — proxy commun à
// generate-image.js et generate-image-status.js. Isolé ici pour que le fournisseur (Replicate,
// modèle FLUX.1 [schnell]) reste un détail d'implémentation derrière une interface normalisée
// (prompt/negative_prompt en entrée, image + coût en sortie) — remplacer ce fichier suffira à
// changer de fournisseur plus tard (§10 : "aucun fournisseur ne doit devenir le cœur du produit").
//
// La clé API (REPLICATE_API_TOKEN) ne vit QUE dans les variables d'environnement Netlify — jamais
// dans ce code, jamais envoyée au navigateur. Même principe que le proxy d'AiXeLN.

const MODEL = "black-forest-labs/flux-schnell";
const API_BASE = "https://api.replicate.com/v1";
// Tarif Replicate au 2026-09 (à réviser si le fournisseur change ses prix) — $3/1000 images.
const COST_PER_IMAGE_USD = 0.003;

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

// Le résultat d'une prédiction réussie est une URL Replicate temporaire — on rapatrie l'image
// tout de suite côté serveur pour ne jamais exposer cette URL (ni sa durée de vie limitée) au
// navigateur : le client reçoit directement les octets à stocker localement (IndexedDB).
async function fetchAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Image générée introuvable au moment de la récupérer.");
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") || "image/png";
  return { imageBase64: buf.toString("base64"), mime };
}

async function normalizeSucceeded(prediction) {
  const output = prediction.output;
  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error("La génération a réussi mais n'a renvoyé aucune image.");
  const { imageBase64, mime } = await fetchAsBase64(url);
  return { status: "succeeded", imageBase64, mime, cost: COST_PER_IMAGE_USD, id: prediction.id };
}

function normalizePending(prediction) {
  return { status: "processing", id: prediction.id };
}

function normalizeFailed(prediction) {
  return { status: "failed", error: (prediction && prediction.error) || "Génération échouée côté fournisseur." };
}

module.exports = { MODEL, API_BASE, COST_PER_IMAGE_USD, requireToken, fetchAsBase64, normalizeSucceeded, normalizePending, normalizeFailed };
