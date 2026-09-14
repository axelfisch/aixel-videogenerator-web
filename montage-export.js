// AiXel VideoGenerator — Montage / continuité + export livrable (navigateur)
// Vanilla JS, sans build. Dépend de AiXelDB (db.js) pour les blobs IndexedDB.
(function (global) {
  "use strict";

  function clipsFromProject(project) {
    const shots = (project.storyboard && project.storyboard.shots) || [];
    return shots
      .map((sh, index) => {
        const v = (sh.videos || []).find((x) => x.id === sh.selectedVideoId);
        if (!v || !v.sourceId) return null;
        return {
          shot: sh,
          video: v,
          sourceId: v.sourceId,
          index,
          start: sh.start || 0,
          dur: Math.max(0.1, sh.dur || 0),
          label: sh.action || `Plan ${index + 1}`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start || a.index - b.index);
  }

  function continuityAlerts(project) {
    const alerts = [];
    const shots = (project.storyboard && project.storyboard.shots) || [];
    const clips = clipsFromProject(project);
    if (!project.audioLocked || !project.audio) {
      alerts.push({ level: "priority", tag: "Prioritaire", title: "Audio maître manquant", body: "Verrouille l'audio avant le montage final." });
    }
    if (!project.production || !project.production.locked) {
      alerts.push({ level: "warn", tag: "À corriger", title: "Production non verrouillée", body: "Verrouille la production pour figer les vidéos choisies." });
    }
    const missing = shots.filter((sh) => !sh.selectedVideoId);
    if (missing.length) {
      alerts.push({
        level: "warn",
        tag: "À corriger",
        title: `${missing.length} plan${missing.length > 1 ? "s" : ""} sans vidéo choisie`,
        body: "Ces plans seront sautés dans la timeline de montage.",
      });
    }
    if (!clips.length) {
      alerts.push({ level: "priority", tag: "Prioritaire", title: "Aucune vidéo à monter", body: "Choisis au moins une vidéo en Production." });
    }
    const audioDur = project.audio && project.audio.duration ? project.audio.duration : 0;
    if (clips.length && audioDur) {
      const last = clips[clips.length - 1];
      const end = (last.start || 0) + (last.dur || 0);
      if (Math.abs(end - audioDur) > 1.5) {
        alerts.push({
          level: end < audioDur - 1.5 ? "warn" : "ok",
          tag: end < audioDur - 1.5 ? "À corriger" : "Info",
          title: "Durée timeline vs audio",
          body: `Fin des plans ≈ ${end.toFixed(1)}s, audio ≈ ${audioDur.toFixed(1)}s.`,
        });
      } else {
        alerts.push({ level: "ok", tag: "Valide", title: "Durée alignée", body: "La fin des plans colle à la durée audio (±1,5s)." });
      }
    }
    if (project.montage && project.montage.locked) {
      alerts.push({ level: "ok", tag: "Valide", title: "Montage verrouillé", body: "Prêt pour le contrôle qualité et l'export." });
    }
    return alerts;
  }

  function pickRecorderMime() {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9",
      "video/webm",
    ];
    if (typeof MediaRecorder === "undefined") return null;
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  }

  function loadVideoElement(url) {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.src = url;
      v.onloadeddata = () => resolve(v);
      v.onerror = () => reject(new Error("Impossible de charger une vidéo de plan."));
    });
  }

  async function exportDeliverable(project, opts) {
    const onProgress = (opts && opts.onProgress) || function () {};
    const getUrl = opts && opts.getUrl;
    if (!getUrl) throw new Error("Export : getUrl requis.");
    if (!project.audio || !project.audio.sourceId) throw new Error("Audio maître manquant.");
    const clips = clipsFromProject(project);
    if (!clips.length) throw new Error("Aucune vidéo choisie à exporter.");

    const mime = pickRecorderMime();
    if (mime == null) throw new Error("MediaRecorder indisponible dans ce navigateur.");

    const W = 1280;
    const H = 720;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    const audioBlob = await AiXelDB.getBlob(project.audio.sourceId);
    if (!audioBlob) throw new Error("Blob audio introuvable dans IndexedDB.");

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuf = await audioCtx.decodeAudioData(await audioBlob.arrayBuffer());
    const audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuf;
    const dest = audioCtx.createMediaStreamDestination();
    audioSource.connect(dest);
    audioSource.connect(audioCtx.destination); // monitoring optional — comment out if double audio unwanted during export
    // Avoid double play: disconnect speakers, keep only dest for recording
    audioSource.disconnect();
    audioSource.connect(dest);

    const canvasStream = canvas.captureStream(30);
    const tracks = [...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
    const combined = new MediaStream(tracks);
    const recorder = new MediaRecorder(combined, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : { videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

    const done = new Promise((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("Échec MediaRecorder."));
    });

    // Preload clip URLs
    const urls = [];
    for (const c of clips) {
      const url = await getUrl(c.sourceId);
      if (!url) throw new Error(`Vidéo manquante pour le plan « ${c.label} ».`);
      urls.push(url);
    }

    const totalDur = Math.max(project.audio.duration || 0, clips[clips.length - 1].start + clips[clips.length - 1].dur);
    recorder.start(250);
    audioSource.start(0);

    const t0 = performance.now();
    let clipIdx = 0;
    let currentVideo = await loadVideoElement(urls[0]);
    try { await currentVideo.play(); } catch (_) {}

    await new Promise((resolve) => {
      const tick = async () => {
        const t = (performance.now() - t0) / 1000;
        onProgress(Math.min(1, t / Math.max(totalDur, 0.01)));

        // Switch clip when timeline crosses next shot start
        while (clipIdx + 1 < clips.length && t >= clips[clipIdx + 1].start) {
          clipIdx += 1;
          currentVideo.pause();
          currentVideo = await loadVideoElement(urls[clipIdx]);
          try { await currentVideo.play(); } catch (_) {}
        }

        ctx.fillStyle = "#05070c";
        ctx.fillRect(0, 0, W, H);
        if (currentVideo && currentVideo.readyState >= 2) {
          const vw = currentVideo.videoWidth || W;
          const vh = currentVideo.videoHeight || H;
          const scale = Math.max(W / vw, H / vh);
          const dw = vw * scale;
          const dh = vh * scale;
          ctx.drawImage(currentVideo, (W - dw) / 2, (H - dh) / 2, dw, dh);
        }

        // Caption
        const clip = clips[clipIdx];
        if (clip) {
          const grad = ctx.createLinearGradient(0, H - 80, 0, H);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(1, "rgba(0,0,0,0.75)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, H - 80, W, 80);
          ctx.fillStyle = "#fff";
          ctx.font = "600 18px system-ui,sans-serif";
          ctx.fillText(clip.label.slice(0, 80), 24, H - 28);
        }

        if (t >= totalDur) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    try { audioSource.stop(); } catch (_) {}
    recorder.stop();
    await done;
    await audioCtx.close().catch(() => {});

    const outType = (recorder.mimeType || mime || "video/webm").split(";")[0];
    const blob = new Blob(chunks, { type: outType || "video/webm" });
    if (!blob.size) throw new Error("Export vide — réessaie ou change de navigateur (Chrome/Edge recommandés).");
    onProgress(1);
    return { blob, mime: blob.type || "video/webm", duration: totalDur, clipCount: clips.length };
  }

  global.AiXelMontage = {
    clipsFromProject,
    continuityAlerts,
    exportDeliverable,
    pickRecorderMime,
  };
})(window);
