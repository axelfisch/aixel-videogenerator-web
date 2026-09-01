// AiXel VideoGenerator — cockpit V0 (reconstruction en code source, 2026-09-01)
// Reproduit fidèlement le pilote BMW/BNC — MAT construit avec Codex, mais en JS éditable,
// sans dépendance à un framework figé. Vanilla JS + localStorage, comme le reste des apps AiXel.
const BUILD = "V0 · 2026-09-01 (reconstruction source)";
const STORAGE_KEY = "aixel-videogenerator:bmw-bnc";

const STEP_DEFS = [
  { id: "sources", name: "Sources" },
  { id: "audio", name: "Audio verrouillé" },
  { id: "carte", name: "Carte musicale" },
  { id: "brief", name: "Brief créatif" },
  { id: "bibles", name: "Bibles visuelles" },
  { id: "histoire", name: "Histoire & motifs" },
  { id: "storyboard", name: "Storyboard" },
  { id: "images", name: "Images tests" },
  { id: "animatique", name: "Animatique" },
  { id: "production", name: "Production" },
  { id: "montage", name: "Montage & paroles" },
  { id: "qualite", name: "Qualité & exports" },
];

const STRUCTURE = [
  { id: "intro", label: "Intro", tag: "Installation", start: 0, energy: 32, dur: 17 },
  { id: "c1", label: "Couplet 1", tag: "Confiance", start: 17, energy: 57, dur: 34 },
  { id: "refrain", label: "Refrain", tag: "Éclat", start: 51, energy: 91, dur: 27 },
  { id: "c2", label: "Couplet 2", tag: "Mouvement", start: 78, energy: 68, dur: 34 },
  { id: "pont", label: "Pont", tag: "Suspension", start: 112, energy: 46, dur: 25 },
  { id: "final", label: "Final", tag: "Libération", start: 137, energy: 90, dur: 50 },
];

function defaultState() {
  return {
    steps: STEP_DEFS.map((s, i) => ({
      ...s,
      status: i < 2 ? "done" : i === 4 ? "done" : i === 2 ? "active" : "pending",
    })),
    activeStepId: "carte",
    audio: { file: "BMW_BNC.wav", duration: 187.12, bpm: 117, peak: 3.1, profile: "Énergique" },
    playedRatio: 0.28,
    structure: STRUCTURE,
    decision: { selected: null, locked: false, lockedBy: null, lockedAt: null },
    creditsAvoided: 340,
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

// Forme d'onde déterministe (même graine à chaque rendu) — sera remplacée par une vraie
// analyse locale (Web Audio API) quand l'import audio réel sera branché en V0.5/V1.
function seededWave(n, seed) {
  let x = seed;
  const rand = () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return (x % 1000) / 1000;
  };
  const bars = [];
  for (let i = 0; i < n; i++) {
    const base = 0.25 + 0.55 * Math.abs(Math.sin(i / 6)) ;
    bars.push(Math.max(0.08, Math.min(1, base + (rand() - 0.5) * 0.3)));
  }
  return bars;
}
const WAVE = seededWave(120, 42);

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function progressPct() {
  const weight = state.steps.reduce((acc, s) => acc + (s.status === "done" ? 1 : s.status === "active" ? 0.5 : 0), 0);
  return Math.round((weight / state.steps.length) * 100);
}

function stepIcon(status) {
  if (status === "done") return "✓";
  if (status === "active") return "";
  return "";
}

function render() {
  const app = document.getElementById("app");
  const pct = progressPct();
  const activeStep = state.steps.find((s) => s.id === state.activeStepId) || state.steps[2];

  app.innerHTML = `
    ${renderLeftRail(pct)}
    <main class="main">
      <div class="crumb">BMW / BNC / PRÉPRODUCTION</div>
      <div class="page-head">
        <h1>${activeStep.name}</h1>
        <span class="status-chip">Analyse locale terminée</span>
      </div>
      <p class="page-sub">La structure est analysée. Ta validation artistique décidera du rythme du storyboard.</p>

      ${state.decision.locked ? renderLockedBanner() : ""}

      <div class="card audio-card">
        <div class="row">
          <button class="play-btn" id="playBtn" aria-label="Lire">▶</button>
          <div class="audio-meta">
            <div class="fname">${state.audio.file}</div>
            <div class="ftag">MASTER AUDIO · VERROUILLÉ</div>
          </div>
          <div class="audio-time">${fmtTime(state.audio.duration * state.playedRatio)} / ${fmtTime(state.audio.duration)}</div>
        </div>
        <div class="waveform" id="waveform">
          ${WAVE.map((h, i) => `<i style="height:${Math.round(h * 100)}%" class="${i / WAVE.length < state.playedRatio ? "played" : ""}"></i>`).join("")}
        </div>
        <div class="metric-row">
          <div class="metric"><b>${state.audio.bpm}</b><small>BPM estimé</small></div>
          <div class="metric"><b>${fmtTime(state.audio.duration)}</b><small>durée</small></div>
          <div class="metric"><b>+${state.audio.peak.toFixed(1)} dB</b><small>crête</small></div>
          <div class="metric"><b style="font-size:14px">${state.audio.profile}</b><small>profil dominant</small></div>
        </div>
      </div>

      <div class="card">
        <div class="section-head">
          <h2>Structure proposée</h2>
          <span class="count">${state.structure.length} sections · 24 plans recommandés</span>
        </div>
        <div class="struct-grid">
          ${state.structure.map((s, i) => `
            <div class="struct-card ${s.id === "refrain" ? "current" : ""}">
              <div class="top"><span>0${i + 1}</span><span>${fmtTime(s.start)}</span></div>
              <div class="title">${s.label}</div>
              <div class="sub">${s.tag}</div>
              <div class="energy-bar"><i style="width:${s.energy}%"></i></div>
              <div class="dur">${s.energy}% énergie · ${fmtTime(s.dur)}</div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="card decision-card">
        <div class="decision-icon">✦</div>
        <div class="decision-body">
          <h3>Décision artistique requise</h3>
          <p>Le refrain doit-il accélérer le montage ? L'analyse détecte un pic à 00:51. Je propose des plans de 2,8&nbsp;s, contre 4,6&nbsp;s dans le couplet.</p>
          <div class="decision-opts">
            <button class="opt-btn ${state.decision.selected === "accelerer" ? "selected" : ""}" data-opt="accelerer" ${state.decision.locked ? "disabled" : ""}>
              <b>A · Accélérer</b><small>8 plans · impact fort</small>
            </button>
            <button class="opt-btn ${state.decision.selected === "respirer" ? "selected" : ""}" data-opt="respirer" ${state.decision.locked ? "disabled" : ""}>
              <b>B · Respirer</b><small>5 plans · plus cinématique</small>
            </button>
          </div>
          ${state.decision.lockedAt ? `<div class="decision-log"><b>${state.decision.locked ? "Verrouillé" : "Modifié"}</b> par Axel Fisch — ${new Date(state.decision.lockedAt).toLocaleString("fr-CA")}</div>` : ""}
        </div>
        <div class="decision-actions">
          <button class="btn primary" id="lockBtn" ${state.decision.selected ? "" : "disabled"}>${state.decision.locked ? "Rouvrir la barrière" : "Valider la direction →"}</button>
        </div>
      </div>
    </main>
    ${renderRightRail()}
  `;

  bind();
}

function renderLockedBanner() {
  return `<div class="locked-banner">🔒 Carte musicale verrouillée — cette étape sert désormais de référence pour le storyboard.
    <button class="btn small reopen" id="reopenBtn">Rouvrir</button></div>`;
}

function renderLeftRail(pct) {
  return `
    <aside class="left-rail">
      <div class="brand">
        <div class="mark">A</div>
        <div class="lines">
          <div class="studio">AIXEL STUDIO</div>
          <div class="app-name">VideoGenerator</div>
        </div>
        <span class="pilot-badge">PILOTE · V0</span>
      </div>

      <div class="project-select">
        <div class="label">PROJET ACTIF</div>
        <div class="name"><span>BMW / BNC — MAT</span><span>▾</span></div>
      </div>

      <div>
        <div class="process-head">
          <b>Processus AiXel</b>
          <span class="process-pct">${pct}%</span>
        </div>
        <div class="process-bar"><i style="width:${pct}%"></i></div>
        <div class="steps">
          ${state.steps.map((s) => `
            <div class="step ${s.status} ${s.id === state.activeStepId ? "active" : ""}" data-step="${s.id}">
              <span class="num">${stepIcon(s.status)}</span>
              <span class="name">${s.name}</span>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="credits-card">
        <div class="amt">≈ ${state.creditsAvoided}</div>
        <div class="lbl">crédits évités grâce aux validations en amont</div>
      </div>
    </aside>
  `;
}

function renderRightRail() {
  const score = 78;
  return `
    <aside class="right-rail" style="--pct:${score}">
      <div class="score-card">
        <div class="score-ring" style="--pct:${score}"><b>${score}</b></div>
        <div class="stage">Préproduction</div>
        <div class="note">Solide, à sécuriser</div>
      </div>

      <div class="rail-h">Alertes de continuité <span>3</span></div>
      <div class="alert priority">
        <span class="tag">Prioritaire</span>
        <b>Véhicule non verrouillé dans 6 plans</b>
        <p>Le modèle change entre Bentley, BMW et cabriolet générique.</p>
      </div>
      <div class="alert warn">
        <span class="tag">À corriger</span>
        <b>Générique final non conforme</b>
        <p>Remplacer les faux crédits par le master AiXel Studio officiel.</p>
      </div>
      <div class="alert ok">
        <span class="tag">Valide</span>
        <b>Identité de MAT stable</b>
        <p>Visage, lunettes, bomber et bijoux reconnus sur les références.</p>
      </div>

      <div class="rail-h">Références verrouillées <button class="link-btn">Tout voir</button></div>
      <div class="ref-grid">
        <div class="ref-item first" style="background:linear-gradient(135deg,#1c2c46,#3fd6f5 140%)">
          <div class="cap">MAT · Canon v1</div>
        </div>
        <div class="ref-item" style="background:linear-gradient(135deg,#2a1f3d,#f26fd0 160%)">
          <div class="cap">Neon Drive</div>
        </div>
        <div class="ref-item" style="background:linear-gradient(135deg,#241d10,#e8b95c 160%)">
          <div class="cap">Logo AiXel</div>
        </div>
      </div>

      <button class="btn primary prep-btn" id="prepBtn" ${state.decision.locked ? "" : "disabled"}>Préparer l'animatique →</button>
    </aside>
  `;
}

function bind() {
  document.querySelectorAll(".opt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.decision.locked) return;
      const opt = btn.dataset.opt;
      state.decision.selected = state.decision.selected === opt ? null : opt;
      persist();
      render();
    });
  });

  const lockBtn = document.getElementById("lockBtn");
  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      if (state.decision.locked) {
        state.decision.locked = false;
        state.decision.lockedAt = Date.now();
        // Rouvrir la barrière rétrograde l'étape "Carte musicale" à l'état actif (non verrouillée).
      } else {
        if (!state.decision.selected) return;
        state.decision.locked = true;
        state.decision.lockedAt = Date.now();
        const step = state.steps.find((s) => s.id === "carte");
        if (step) step.status = "done";
        const next = state.steps.find((s) => s.id === "brief");
        if (next && next.status === "pending") next.status = "active";
        toast("Carte musicale verrouillée.");
      }
      persist();
      render();
    });
  }

  const reopenBtn = document.getElementById("reopenBtn");
  if (reopenBtn) {
    reopenBtn.addEventListener("click", () => {
      state.decision.locked = false;
      const step = state.steps.find((s) => s.id === "carte");
      if (step) step.status = "active";
      const next = state.steps.find((s) => s.id === "brief");
      if (next && next.status === "active") next.status = "pending";
      persist();
      render();
    });
  }

  const prepBtn = document.getElementById("prepBtn");
  if (prepBtn) {
    prepBtn.addEventListener("click", () => {
      if (!state.decision.locked) return;
      toast("Animatique : module V2.5, pas encore branché dans cette tranche.");
    });
  }

  document.querySelectorAll(".step").forEach((el) => {
    el.addEventListener("click", () => {
      toast(`${STEP_DEFS.find((s) => s.id === el.dataset.step)?.name || ""} : à construire dans une prochaine tranche.`);
    });
  });

  const playBtn = document.getElementById("playBtn");
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      toast("Lecture audio réelle : branchée en V0.5/V1 avec l'import de fichier.");
    });
  }
}

function toast(msg) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

render();
