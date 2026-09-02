// POST /.netlify/functions/generate-video  { prompt, image (data URI ou URL) }
// Démarre une génération vidéo (Production, §8.10) via Replicate — image→vidéo à partir de l'image
// test déjà choisie par Axel pour ce plan (jamais en masse : un plan à la fois, image déjà validée).
// La génération vidéo est nettement plus lente qu'une image test : on attend une réponse rapide
// puis, si ce n'est pas fini, on renvoie l'id à interroger via generate-video-status.js plutôt que
// de laisser la requête ouverte plus longtemps.
//
// Correctif du 2026-09-02 (bug "échoué, a pris trop de temps") : cette fonction tournait avec
// `Prefer: wait=25`, et en test réel EN DIRECT contre le site déployé, Replicate a mis ~30 à 30,3s à
// répondre (au-delà des 25s demandés — Replicate ajoute son propre délai réseau/file d'attente
// avant même de commencer à décompter). Or Netlify Functions passe par une AWS API Gateway dont le
// plafond d'intégration synchrone est un DUR maximum de ~29s, non configurable, quel que soit le
// plan Netlify. Résultat observé en direct : deux appels quasi identiques (~30,2s et ~30,3s) — l'un
// a réussi (200, "processing"), l'autre a été tué par la plateforme (504, page HTML au lieu de JSON)
// — un vrai pile-ou-face à chaque génération, pas un cas rare. Le fallback du client
// (app.js: `data.error || "…a pris trop de temps."`) transformait ce 504 en message d'échec.
// Comme la génération réelle prend de toute façon ~30-35s (jamais moins de 25s dans nos tests), ce
// `wait` long n'apportait aucun bénéfice — juste un risque de 504. On le réduit donc à une valeur
// largement sous le plafond des 29s : la fonction revient presque toujours en "processing" (JSON
// propre), et le polling déjà en place côté client (app.js, toutes les 3s) prend le relais — vérifié
// en direct : une fois prête, la vidéo est récupérée par le polling en moins d'une seconde.
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
        Prefer: "wait=8",
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
