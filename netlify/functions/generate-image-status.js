// GET /.netlify/functions/generate-image-status?id=...
// Suivi d'une génération démarrée par generate-image.js quand elle n'a pas fini dans les 25s
// d'attente initiale. Le client interroge cette route toutes les ~2s jusqu'à un état terminal.
const { API_BASE, requireToken, normalizeSucceeded, normalizePending, normalizeFailed } = require("./_replicate");

exports.handler = async (event) => {
  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) return { statusCode: 400, body: JSON.stringify({ error: "Identifiant de génération manquant." }) };

  try {
    const token = requireToken();
    const res = await fetch(`${API_BASE}/predictions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const prediction = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: prediction.detail || "Suivi de la génération impossible." }) };
    }

    if (prediction.status === "succeeded") {
      return { statusCode: 200, body: JSON.stringify(await normalizeSucceeded(prediction)) };
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      return { statusCode: 200, body: JSON.stringify(normalizeFailed(prediction)) };
    }
    return { statusCode: 200, body: JSON.stringify(normalizePending(prediction)) };
  } catch (err) {
    return { statusCode: err.status || 500, body: JSON.stringify({ error: err.message || "Erreur serveur pendant le suivi." }) };
  }
};
