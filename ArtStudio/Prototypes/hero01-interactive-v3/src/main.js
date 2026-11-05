import './style.css';
import approvedSource from '../../../Generated/Approved/HERO-01_outfit02_playful_maid.png';
import { automaticBlink, blinkEnvelope, createStage } from './rig.js';

const $ = selector => document.querySelector(selector);
const controls = {
  play: $('#play-toggle'),
  playLabel: $('#play-label'),
  playStatus: $('#play-status'),
  blink: $('#blink-button'),
  body: $('#view-body'),
  face: $('#view-face'),
  intensity: $('#intensity'),
  intensityValue: $('#intensity-value'),
  status: $('#connection-status'),
  loading: $('#loading'),
  error: $('#error-message'),
};

const state = {
  playing: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  time: 0,
  strength: 1,
  manualBlinkStart: null,
  currentBlink: 0,
  view: 'body',
  testMode: false,
};
let stage;
let previousTime = performance.now();
let needsRedraw = true;

function syncPlayback() {
  controls.play.classList.toggle('is-paused', !state.playing);
  controls.play.setAttribute('aria-label', state.playing ? 'Пауза' : 'Продолжить анимацию');
  controls.play.setAttribute('aria-pressed', String(!state.playing));
  controls.playLabel.textContent = state.playing ? 'Пауза' : 'Продолжить';
  controls.playStatus.textContent = state.playing ? 'Анимация включена' : 'Анимация на паузе';
  controls.status.textContent = state.playing ? 'ИДЁТ ПРОСМОТР' : 'ПАУЗА';
}

function setView(view) {
  state.view = view;
  needsRedraw = true;
  document.querySelector('.viewport-pair').classList.toggle('is-face', view === 'face');
  controls.body.classList.toggle('is-active', view === 'body');
  controls.face.classList.toggle('is-active', view === 'face');
  controls.body.setAttribute('aria-pressed', String(view === 'body'));
  controls.face.setAttribute('aria-pressed', String(view === 'face'));
  if (stage) stage.setView(view);
}

function draw(now) {
  const delta = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
  previousTime = now;
  if (!state.testMode && !document.hidden) {
    if (state.playing) state.time += delta;
    // Pausing freezes the automatic blink as well as the mesh. The manual
    // test takes precedence temporarily, so it also works while paused.
    let blink = automaticBlink(state.time);
    const manualActive = state.manualBlinkStart !== null;
    if (manualActive) {
      const elapsed = (now - state.manualBlinkStart) / 1000;
      blink = blinkEnvelope(elapsed);
      if (elapsed > 0.42) state.manualBlinkStart = null;
    }
    state.currentBlink = blink;
    // A paused rig does not need a full WebGL redraw on every display tick.
    if (state.playing || manualActive || needsRedraw) {
      stage.render(state.time, state.strength, blink);
      needsRedraw = false;
    }
  }
  requestAnimationFrame(draw);
}

async function initialize() {
  try {
    stage = await createStage($('#original-view'), $('#animated-view'), approvedSource, import.meta.env.BASE_URL);
    stage.setView(state.view);
    controls.loading.hidden = true;
    controls.play.disabled = false;
    controls.blink.disabled = false;
    controls.intensity.disabled = false;
    syncPlayback();
    previousTime = performance.now();
    requestAnimationFrame(draw);

    // Deterministic, opt-in QA hook. It never runs in production builds.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
      window.__HERO_QA__ = {
        frame({ time = 0, blink = 0, strength = 1 } = {}) {
          state.testMode = true;
          stage.render(time, strength, blink);
          return stage.geometryStats();
        },
        resume() { state.testMode = false; needsRedraw = true; previousTime = performance.now(); },
        getState() { return { ...state, sourceHash: stage.metadata.source_sha256 }; },
        geometry() { return stage.geometryStats(); },
        comparePixels() { return stage.comparePixels(); },
        compareFrames(first, second) { state.testMode = true; return stage.compareFrames(first, second); },
      };
    }
  } catch (error) {
    console.error('Character prototype failed to initialize:', error);
    controls.loading.hidden = true;
    controls.error.textContent = 'Не удалось запустить сцену. Проверьте поддержку WebGL и перезагрузите страницу.';
    controls.error.hidden = false;
    controls.status.textContent = 'ОШИБКА ЗАГРУЗКИ';
  }
}

controls.play.addEventListener('click', () => {
  state.playing = !state.playing;
  needsRedraw = true;
  syncPlayback();
});
controls.blink.addEventListener('click', () => { state.manualBlinkStart = performance.now(); needsRedraw = true; });
controls.body.addEventListener('click', () => setView('body'));
controls.face.addEventListener('click', () => setView('face'));
controls.intensity.addEventListener('input', event => {
  state.strength = Number(event.target.value) / 100;
  needsRedraw = true;
  controls.intensityValue.value = `${event.target.value}%`;
});

document.addEventListener('visibilitychange', () => { previousTime = performance.now(); });
initialize();
