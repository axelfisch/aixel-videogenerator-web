// POST /.netlify/functions/generate-image  { prompt, negativePrompt? }
// Démarre une génération d'image de test (Image Lab, §8.8) via Replicate. Attend jusqu'à 25s
// (FLUX.1 [schnell] répond typiquement en 1-3s) ; si ce n'est pas encore terminé, renvoie l'id
// à interroger via generate-image-status.js plutôt que de laisser la requête ouverte plus
// longtemps (les fonctions Netlify ont un temps d'exécution limité).
const { MODEL, API_BASE, requireToken, normalizeSucceeded, normalizePending, normalizeFailed } = require("./_replicate");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const prompt = (body.prompt || "").trim();
  if (!prompt) return { statusCode: 400, body: JSON.stringify({ error: "Prompt vide — rien à générer." }) };

  try {
    const token = requireToken();
    const input = { prompt, aspect_ratio: "16:9", output_format: "png", num_outputs: 1 };
    if (body.negativePrompt && String(body.negativePrompt).trim()) {
      input.negative_prompt = String(body.negativePrompt).trim();
    }

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
      return { statusCode: res.status, body: JSON.stringify({ error: prediction.detail || prediction.error || "Le fournisseur de génération a refusé la demande." }) };
    }

    if (prediction.status === "succeeded") {
      return { statusCode: 200, body: JSON.stringify(await normalizeSucceeded(prediction)) };
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      return { statusCode: 200, body: JSON.stringify(normalizeFailed(prediction)) };
    }
    return { statusCode: 200, body: JSON.stringify(normalizePending(prediction)) };
  } catch (err) {
    return { statusCode: err.status || 500, body: JSON.stringify({ error: err.message || "Erreur serveur pendant la génération." }) };
  }
};
