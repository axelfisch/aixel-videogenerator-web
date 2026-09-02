// GET /.netlify/functions/generate-video-status?id=...&frames=...
// Suivi d'une génération vidéo démarrée par generate-video.js quand elle n'a pas fini dans les 25s
// d'attente initiale (fréquent — une vidéo prend souvent 30s à 2min). Le client interroge cette
// route toutes les ~3s jusqu'à un état terminal. `frames` est renvoyé par le client (le même nombre
// que sur la requête initiale) pour recalculer le coût réel une fois la vidéo prête.
const { API_BASE, requireToken, normalizeSucceeded, normalizePending, normalizeFailed } = require("./_replicate-video");

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const id = q.id;
  const frames = Math.max(5, Math.min(100, parseInt(q.frames, 10) || 81));
  if (!id) return { statusCode: 400, body: JSON.stringify({ error: "Identifiant de génération manquant." }) };

  try {
    const token = requireToken();
    const res = await fetch(`${API_BASE}/predictions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const prediction = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: prediction.detail || "Suivi de la génération vidéo impossible." }) };
    }

    if (prediction.status === "succeeded") {
      return { statusCode: 200, body: JSON.stringify(await normalizeSucceeded(prediction, frames)) };
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      return { statusCode: 200, body: JSON.stringify(normalizeFailed(prediction)) };
    }
    return { statusCode: 200, body: JSON.stringify({ ...normalizePending(prediction), frames }) };
  } catch (err) {
    return { statusCode: err.status || 500, body: JSON.stringify({ error: err.message || "Erreur serveur pendant le suivi vidéo." }) };
  }
};
