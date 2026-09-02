// POST /.netlify/functions/generate-video  { prompt, image (data URI ou URL), aspectRatio? }
// Démarre une génération vidéo (Production, §8.10) via Replicate — image→vidéo à partir de l'image
// test déjà choisie par Axel pour ce plan (jamais en masse : un plan à la fois, image déjà validée).
// La génération vidéo est nettement plus lente qu'une image test : on attend une réponse rapide
// (jusqu'à 25s) puis, si ce n'est pas fini, on renvoie l'id à interroger via
// generate-video-status.js plutôt que de laisser la requête ouverte plus longtemps.
const { MODEL, API_BASE, requireToken, normalizeSucceeded, normalizePending, normalizeFailed } = require("./_replicate-video");

// Marqueur temporaire (2026-09-02) — permet de vérifier à distance, via un simple fetch, que le
// déploiement en cours sert bien CE code (et pas une version précédente restée en ligne) sans avoir
// besoin d'accéder au tableau de bord Netlify. À retirer une fois la chaîne de déploiement
// confirmée fiable (idéalement après avoir lié le dépôt GitHub à Netlify pour un déploiement
// automatique, cf. README).
const BUILD_MARKER = "2026-09-02-schema-fix-v1";

exports.handler = async (event) => {
  const headers = { "X-AiXel-Build": BUILD_MARKER };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Méthode non autorisée." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { body = {}; }
  const prompt = (body.prompt || "").trim();
  const image = body.image;
  const aspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9";
  if (!image) return { statusCode: 400, headers, body: JSON.stringify({ error: "Image de référence manquante — choisis d'abord une image test pour ce plan." }) };

  try {
    const token = requireToken();
    // Champs alignés sur le schéma RÉEL du modèle (vérifié le 2026-09-02 sur
    // replicate.com/wavespeedai/wan-2.1-i2v-480p/api/schema) — plus de num_frames/max_area, qui
    // n'existent plus côté fournisseur et faisaient échouer chaque appel (voir _replicate-video.js).
    const input = { image, aspect_ratio: aspectRatio };
    if (prompt) input.prompt = prompt;

    const res = await fetch(`${API_BASE}/models/${MODEL}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=25",
      },
      body: JSON.stringify({ input }),
    });
    const rawText = await res.text();
    let prediction;
    try { prediction = JSON.parse(rawText); } catch (e) { prediction = {}; }
    // _debug (temporaire, 2026-09-02) : renvoie le statut HTTP brut de Replicate et le champ
    // d'entrée exact envoyé, pour confirmer en un seul appel ce qui a réellement été transmis —
    // sans avoir besoin des logs du tableau de bord Netlify. À retirer une fois confirmé.
    const _debug = { sentInput: input, replicateHttpStatus: res.status, replicatePredictionStatus: prediction.status || null };
    if (!res.ok) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: prediction.detail || prediction.error || "Le fournisseur de génération vidéo a refusé la demande.", _debug }) };
    }

    if (prediction.status === "succeeded") {
      return { statusCode: 200, headers, body: JSON.stringify({ ...(await normalizeSucceeded(prediction)), _debug }) };
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      return { statusCode: 200, headers, body: JSON.stringify({ ...normalizeFailed(prediction), _debug }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ...normalizePending(prediction), _debug }) };
  } catch (err) {
    return { statusCode: err.status || 500, headers, body: JSON.stringify({ error: err.message || "Erreur serveur pendant la génération vidéo." }) };
  }
};
