// POST /.netlify/functions/generate-video  { prompt, image (data URI ou URL), aspectRatio? }
// Démarre une génération vidéo (Production, §8.10) via Replicate — image→vidéo à partir de l'image
// test déjà choisie par Axel pour ce plan (jamais en masse : un plan à la fois, image déjà validée).
// La génération vidéo est nettement plus lente qu'une image test : on attend une réponse rapide
// (jusqu'à 25s) puis, si ce n'est pas fini, on renvoie l'id à interroger via
// generate-video-status.js plutôt que de laisser la requête ouverte plus longtemps.
const { MODEL, API_BASE, requireToken, normalizeSucceeded, normalizePending, normalizeFailed } = require("./_replicate-video");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { body = {}; }
  const prompt = (body.prompt || "").trim();
  const image = body.image;
  const aspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9";
  if (!image) return { statusCode: 400, body: JSON.stringify({ error: "Image de référence manquante — choisis d'abord une image test pour ce plan." }) };

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
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: prediction.detail || prediction.error || "Le fournisseur de génération vidéo a refusé la demande." }) };
    }

    if (prediction.status === "succeeded") {
      return { statusCode: 200, body: JSON.stringify(await normalizeSucceeded(prediction)) };
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      return { statusCode: 200, body: JSON.stringify(normalizeFailed(prediction)) };
    }
    return { statusCode: 200, body: JSON.stringify(normalizePending(prediction)) };
  } catch (err) {
    return { statusCode: err.status || 500, body: JSON.stringify({ error: err.message || "Erreur serveur pendant la génération vidéo." }) };
  }
};
