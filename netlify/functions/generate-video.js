// POST /.netlify/functions/generate-video  { prompt, image (data URI ou URL) }
// Démarre une génération vidéo (Production, §8.10) via Replicate — image→vidéo à partir de l'image
// test déjà choisie par Axel pour ce plan (jamais en masse : un plan à la fois, image déjà validée).
// La génération vidéo est nettement plus lente qu'une image test : on attend une réponse rapide
// (jusqu'à 25s) puis, si ce n'est pas fini, on renvoie l'id à interroger via
// generate-video-status.js plutôt que de laisser la requête ouverte plus longtemps.
const { MODEL, API_BASE, OUTPUT_FRAMES, FPS, requireToken, normalizeSucceeded, normalizePending, normalizeFailed } = require("./_replicate-video");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { body = {}; }
  const prompt = (body.prompt || "").trim();
  const image = body.image;
  if (!image) return { statusCode: 400, body: JSON.stringify({ error: "Image de référence manquante — choisis d'abord une image test pour ce plan." }) };

  try {
    const token = requireToken();
    // Champs du modèle wan-video/wan-2.2-i2v-a14b (vérifiés le 2026-09-02 sur
    // replicate.com/wan-video/wan-2.2-i2v-a14b/api/schema) : image, prompt, num_frames (81-100),
    // resolution ("480p"/"720p"), frames_per_second (5-24). On reste sur les valeurs par défaut du
    // modèle (81 images, 480p, 16 im/s) pour une sortie prévisible et au tarif fixe le plus bas.
    const input = { image, num_frames: OUTPUT_FRAMES, resolution: "480p", frames_per_second: FPS };
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
