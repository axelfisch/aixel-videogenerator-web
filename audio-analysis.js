// Analyse audio locale — portée depuis AiXel Visual Melody (src/audio/*.ts), qui fait déjà
// tourner ce code en production (décodage, forme d'onde, énergie RMS, BPM) sur
// visualmelody.netlify.app. Même méthode, réécrite en JS vanille (pas de TypeScript/build ici).
// La détection de structure (Intro/Couplet/Refrain...) est nouvelle pour VideoGenerator —
// Visual Melody n'en a pas besoin, VideoGenerator si (carte musicale).
const AiXelAudio = (() => {
  const ENERGY_FPS = 30;
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

  async function decodeAudioFile(blobOrFile) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) throw new Error("L'analyse audio n'est pas disponible dans ce navigateur.");
    const context = new AudioContextCtor();
    try {
      const arrayBuffer = await blobOrFile.arrayBuffer();
      return await context.decodeAudioData(arrayBuffer);
    } catch {
      throw new Error("Le fichier audio n'a pas pu être décodé.");
    } finally {
      await context.close();
    }
  }

  function mixToMono(buffer) {
    if (buffer.numberOfChannels < 1) throw new Error("Le fichier audio ne contient aucun canal.");
    const mono = new Float32Array(buffer.length);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
    }
    return mono;
  }

  function buildWaveform(samples, bins = 120) {
    if (bins < 1) return [];
    return Array.from({ length: bins }, (_, index) => {
      const start = Math.floor((index * samples.length) / bins);
      const end = Math.max(start + 1, Math.floor(((index + 1) * samples.length) / bins));
      let peak = 0;
      for (let s = start; s < Math.min(samples.length, end); s++) peak = Math.max(peak, Math.abs(samples[s]));
      return clamp(peak);
    });
  }

  function buildEnergyTimeline(samples, sampleRate, fps = ENERGY_FPS) {
    const frameSize = Math.max(1, Math.floor(sampleRate / fps));
    const values = [];
    let maximum = 0;
    for (let start = 0; start < samples.length; start += frameSize) {
      let sum = 0;
      const end = Math.min(samples.length, start + frameSize);
      for (let i = start; i < end; i++) sum += samples[i] * samples[i];
      const rms = Math.sqrt(sum / Math.max(1, end - start));
      values.push(rms);
      maximum = Math.max(maximum, rms);
    }
    if (maximum === 0) return values.map(() => 0);
    return values.map((v) => clamp(v / maximum));
  }

  // Estimation MVP par enveloppe énergétique (comme Visual Melody) — guide le rythme visuel,
  // ne remplace pas une détection musicale professionnelle.
  function estimateBpm(samples, sampleRate) {
    const windowDuration = 0.05;
    const windowSize = Math.max(1, Math.floor(sampleRate * windowDuration));
    const envelope = [];
    for (let start = 0; start < samples.length; start += windowSize) {
      let sum = 0;
      const end = Math.min(samples.length, start + windowSize);
      for (let i = start; i < end; i++) sum += samples[i] * samples[i];
      envelope.push(Math.sqrt(sum / Math.max(1, end - start)));
    }
    const mean = envelope.reduce((s, v) => s + v, 0) / Math.max(1, envelope.length);
    const peaks = envelope
      .map((value, index) => ({ value, index }))
      .filter(({ value, index }) => value > mean * 1.35 && value >= (envelope[index - 1] ?? 0) && value > (envelope[index + 1] ?? 0));

    let bestBpm = 120, bestScore = -Infinity;
    for (let bpm = 60; bpm <= 180; bpm++) {
      const interval = (60 / bpm) / windowDuration;
      let score = 0;
      for (let a = 0; a < peaks.length; a++) {
        for (let b = a + 1; b < Math.min(peaks.length, a + 9); b++) {
          const distance = peaks[b].index - peaks[a].index;
          const nearestBeat = Math.max(1, Math.round(distance / interval));
          const error = Math.abs(distance - nearestBeat * interval);
          if (error < 1.5) score += peaks[a].value * peaks[b].value * (1 - error / 1.5);
        }
      }
      if (score > bestScore) { bestScore = score; bestBpm = bpm; }
    }
    return bestBpm;
  }

  // Proposition de structure — regroupe les fenêtres d'énergie voisines et de niveau similaire
  // en sections, puis leur donne un nom plausible (Intro/Couplet/Refrain/Pont/Final) d'après
  // leur énergie relative. C'est une PROPOSITION à corriger, pas une analyse de structure
  // musicale au sens propre (pas de détection d'accords/de mesures).
  function proposeSections(energy, fps = ENERGY_FPS, durationSec) {
    if (!energy.length) return [];
    const windowSec = 8;
    const framesPerWindow = Math.max(1, Math.round(windowSec * fps));
    const windows = [];
    for (let start = 0; start < energy.length; start += framesPerWindow) {
      const slice = energy.slice(start, Math.min(energy.length, start + framesPerWindow));
      const avg = slice.reduce((s, v) => s + v, 0) / Math.max(1, slice.length);
      windows.push({ startFrame: start, avg });
    }

    // Fusionne les fenêtres voisines de niveau proche en sections brutes.
    const raw = [];
    let current = { startFrame: 0, endFrame: 0, sum: 0, count: 0 };
    windows.forEach((w, i) => {
      if (i === 0) { current = { startFrame: w.startFrame, endFrame: w.startFrame + framesPerWindow, sum: w.avg, count: 1 }; return; }
      const runningAvg = current.sum / current.count;
      if (Math.abs(w.avg - runningAvg) <= 0.16) {
        current.endFrame = w.startFrame + framesPerWindow;
        current.sum += w.avg; current.count += 1;
      } else {
        raw.push(current);
        current = { startFrame: w.startFrame, endFrame: w.startFrame + framesPerWindow, sum: w.avg, count: 1 };
      }
    });
    raw.push(current);

    // Fusionne les sections trop courtes (<12s) dans la voisine la plus proche en niveau.
    const minFrames = 12 * fps;
    let merged = raw.map((s) => ({ ...s, avg: s.sum / s.count }));
    let changed = true;
    while (changed && merged.length > 1) {
      changed = false;
      for (let i = 0; i < merged.length; i++) {
        if (merged[i].endFrame - merged[i].startFrame < minFrames) {
          const prev = merged[i - 1], next = merged[i + 1];
          const target = !prev ? next : !next ? prev
            : Math.abs(prev.avg - merged[i].avg) <= Math.abs(next.avg - merged[i].avg) ? prev : next;
          if (target === prev) prev.endFrame = merged[i].endFrame;
          else next.startFrame = merged[i].startFrame;
          merged.splice(i, 1);
          changed = true;
          break;
        }
      }
    }

    const total = durationSec || energy.length / fps;
    const withEnergy = merged.map((s) => {
      const frames = energy.slice(s.startFrame, s.endFrame);
      const avg = frames.reduce((sum, v) => sum + v, 0) / Math.max(1, frames.length);
      return { start: s.startFrame / fps, end: Math.min(total, s.endFrame / fps), energy: Math.round(avg * 100) };
    }).filter((s) => s.end - s.start > 0.5);

    const maxEnergy = Math.max(...withEnergy.map((s) => s.energy), 1);
    let coupletCount = 0;
    withEnergy.forEach((s, i) => {
      const isFirst = i === 0, isLast = i === withEnergy.length - 1;
      const isPeak = s.energy >= maxEnergy - 8;
      if (isFirst && s.energy < maxEnergy * 0.55) s.label = "Intro";
      else if (isLast && s.energy < maxEnergy * 0.6 && withEnergy.length > 2) s.label = "Final";
      else if (isPeak) s.label = "Refrain";
      else if (!isFirst && !isLast && s.energy < maxEnergy * 0.5) s.label = "Pont";
      else { coupletCount += 1; s.label = `Couplet ${coupletCount}`; }
      s.id = `sec-${i}`;
    });
    return withEnergy;
  }

  async function analyze(blob, { onProgress } = {}) {
    onProgress?.("decode");
    const buffer = await decodeAudioFile(blob);
    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error("La durée audio est invalide.");
    onProgress?.("mono");
    const mono = mixToMono(buffer);
    onProgress?.("waveform");
    const waveform = buildWaveform(mono, 120);
    onProgress?.("energy");
    const energy = buildEnergyTimeline(mono, buffer.sampleRate);
    onProgress?.("bpm");
    const bpm = estimateBpm(mono, buffer.sampleRate);
    let peak = 0;
    for (const s of mono) peak = Math.max(peak, Math.abs(s));
    onProgress?.("sections");
    const sections = proposeSections(energy, ENERGY_FPS, buffer.duration);
    return {
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      bpm,
      peak,
      averageEnergy: energy.reduce((s, v) => s + v, 0) / Math.max(1, energy.length),
      waveform,
      sections,
    };
  }

  return { analyze, buildWaveform, buildEnergyTimeline, estimateBpm, proposeSections, mixToMono, decodeAudioFile };
})();
