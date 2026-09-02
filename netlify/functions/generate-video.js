// POST /.netlify/functions/generate-video  { prompt, image (data URI), frames, fps? }
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
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const prompt = (body.prompt || "").trim();
  const image = body.image;
  const frames = Math.max(5, Math.min(100, parseInt(body.frames, 10) || 81));
  if (!image) return { statusCode: 400, body: JSON.stringify({ error: "Image de référence manquante — choisis d'abord une image test pour ce plan." }) };

  try {
    const token = requireToken();
    const input = { image, num_frames: frames, max_area: "832x480" };
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
    const prediction = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: prediction.detail || prediction.error || "Le fournisseur de génération vidéo a refusé la demande." }) };
    }

    if (prediction.status === "succeeded") {
      return { statusCode: 200, body: JSON.stringify(await normalizeSucceeded(prediction, frames)) };
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      return { statusCode: 200, body: JSON.stringify(normalizeFailed(prediction)) };
    }
    return { statusCode: 200, body: JSON.stringify({ ...normalizePending(prediction), frames }) };
  } catch (err) {
    return { statusCode: err.status || 500, body: JSON.stringify({ error: err.message || "Erreur serveur pendant la génération vidéo." }) };
  }
};
