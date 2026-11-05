import './style.css';
import approvedSource from '../../../Generated/Approved/HERO-01_outfit02_playful_maid.png';
import { automaticBlink, blinkEnvelope, createStage } from './rig.js';
import { EXPRESSIONS, ExpressionMixer, ReactionController, STATES } from './reactions.js';

const $ = selector => document.querySelector(selector);
const controls = {
  play: $('#play-toggle'), playLabel: $('#play-label'), playStatus: $('#play-status'),
  blink: $('#blink-button'), body: $('#view-body'), face: $('#view-face'),
  solo: $('#layout-solo'), compare: $('#layout-compare'), touchStatus: $('#touch-status'),
  intensity: $('#intensity'), intensityValue: $('#intensity-value'),
  status: $('#connection-status'), loading: $('#loading'), error: $('#error-message'),
};
const debug = new URLSearchParams(location.search).get('debug') === '1';
const emotionLabels = { happy: 'радость', surprised: 'удивление', shy: 'смущение', blushing: 'румянец', playful: 'игривость', sleepy: 'сонливость', sad: 'грусть' };
const state = {
  playing: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  time: 0, reactionTime: 0, strength: 1, manualBlinkStart: null,
  currentBlink: 0, view: 'body', layout: 'solo', testMode: false,
  lastReaction: null, input: null,
};
const reactions = new ReactionController();
const mixer = new ExpressionMixer();
let stage;
let previousTime = performance.now();
let needsRedraw = true;
let shownIdleHint = true;

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

function setLayout(layout) {
  state.layout = layout;
  document.querySelector('.viewport-pair').classList.toggle('is-solo', layout === 'solo');
  controls.solo.classList.toggle('is-active', layout === 'solo');
  controls.compare.classList.toggle('is-active', layout === 'compare');
  controls.solo.setAttribute('aria-pressed', String(layout === 'solo'));
  controls.compare.setAttribute('aria-pressed', String(layout === 'compare'));
  if (stage) stage.setView(state.view);
  needsRedraw = true;
}

function touch(zone, pointerType = 'unknown') {
  const event = reactions.trigger(zone, state.reactionTime);
  if (!event) return null;
  state.lastReaction = event;
  state.input = pointerType;
  controls.touchStatus.textContent = `${event.label} · ${emotionLabels[event.expression]} · ${event.count}`;
  shownIdleHint = false;
  needsRedraw = true;
  return event;
}

function draw(now) {
  const elapsed = Math.max(0, (now - previousTime) / 1000);
  const delta = Math.min(0.05, elapsed);
  previousTime = now;
  if (!state.testMode && !document.hidden) {
    if (state.playing) state.time += delta;
    // Pausing freezes V1 idle; the independent reaction clock still permits
    // a tap or manual blink to play while paused. No interval/timer stacking.
    state.reactionTime += Math.min(0.2, elapsed);
    const reaction = reactions.sample(state.reactionTime);
    mixer.setTarget(reaction.expression);
    const expression = mixer.update(Math.min(0.1, elapsed));
    let blink = automaticBlink(state.time);
    const manualActive = state.manualBlinkStart !== null;
    if (manualActive) {
      const elapsed = (now - state.manualBlinkStart) / 1000;
      blink = blinkEnvelope(elapsed);
      if (elapsed > 0.42) state.manualBlinkStart = null;
    }
    state.currentBlink = blink;
    const active = reaction.state !== STATES.IDLE || reaction.contributions.length > 0 || expression.amount > 0;
    if (state.playing || manualActive || needsRedraw || active) {
      stage.render(state.time, state.strength, blink, { contributions: reaction.contributions, expression });
      needsRedraw = false;
    }
    if (!shownIdleHint && !active) {
      controls.touchStatus.textContent = 'Коснитесь волос, лица или других частей образа';
      shownIdleHint = true;
    }
  }
  requestAnimationFrame(draw);
}

async function initialize() {
  try {
    stage = await createStage($('#original-view'), $('#animated-view'), approvedSource, import.meta.env.BASE_URL, { debug, onTap: touch });
    stage.setView(state.view);
    controls.loading.hidden = true;
    controls.play.disabled = false;
    controls.blink.disabled = false;
    controls.intensity.disabled = false;
    syncPlayback();
    previousTime = performance.now();
    requestAnimationFrame(draw);

    // Diagnostics are opt-in; ?debug=1 additionally draws hit outlines.
    // A plain public visit never exposes the QA hook or debug overlay.
    if (new URLSearchParams(location.search).has('qa') || debug) {
      window.__HERO_QA__ = {
        frame({ time = 0, blink = 0, strength = 1, expression = 'neutral', amount = 1, contributions = [] } = {}) {
          state.testMode = true;
          const face = { name: expression, amount: expression === 'neutral' ? 0 : amount, ...(EXPRESSIONS[expression] || EXPRESSIONS.neutral) };
          stage.render(time, strength, blink, { expression: face, contributions });
          return stage.geometryStats();
        },
        resume() { state.testMode = false; needsRedraw = true; previousTime = performance.now(); },
        getState() { return { ...state, reaction: reactions.sample(state.reactionTime), facial: { current: mixer.current, target: mixer.target, amount: mixer.amount }, sourceHash: stage.metadata.source_sha256 }; },
        geometry() { return stage.geometryStats(); },
        comparePixels() { return stage.comparePixels(); },
        compareFrames(first, second) { state.testMode = true; return stage.compareFrames(first, second); },
        compareExpressions(first, second, blink = 0) {
          state.testMode = true;
          const face = value => ({ name: value.name, amount: value.name === 'neutral' ? 0 : value.amount ?? 1,
            ...(EXPRESSIONS[value.name] || EXPRESSIONS.neutral) });
          return stage.compareFrames({ time: 0, strength: 1, blink, expression: face(first) },
            { time: 0, strength: 1, blink, expression: face(second) });
        },
        compareBlink(name) {
          state.testMode = true;
          const face = { name, amount: name === 'neutral' ? 0 : 1, ...(EXPRESSIONS[name] || EXPRESSIONS.neutral) };
          return stage.compareFrames({ time: 0, strength: 1, blink: 0, expression: face },
            { time: 0, strength: 1, blink: 1, expression: face });
        },
        sourceToClient(x, y) { return stage.sourceToClient(x, y); },
        zoneAtClient(x, y) { return stage.zoneAtClient(x, y); },
        pendingPointers() { return stage.hitboxes.pendingCount(); },
        trigger(zone) { return touch(zone, 'qa'); },
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

controls.play.addEventListener('click', () => { state.playing = !state.playing; needsRedraw = true; syncPlayback(); });
controls.blink.addEventListener('click', () => { state.manualBlinkStart = performance.now(); needsRedraw = true; });
controls.body.addEventListener('click', () => setView('body'));
controls.face.addEventListener('click', () => setView('face'));
controls.solo.addEventListener('click', () => setLayout('solo'));
controls.compare.addEventListener('click', () => setLayout('compare'));
controls.intensity.addEventListener('input', event => {
  state.strength = Number(event.target.value) / 100;
  needsRedraw = true;
  controls.intensityValue.value = `${event.target.value}%`;
});
// Keyboard alternative for users who cannot point at the canvas.
$('#animated-view').addEventListener('keydown', event => {
  const zones = { 1: 'head', 2: 'hair', 3: 'face', 4: 'shoulderRight', 5: 'armRight', 6: 'handRight', 7: 'upperTorso', 8: 'waist', 9: 'legLeft' };
  if (zones[event.key]) { event.preventDefault(); touch(zones[event.key], 'keyboard'); }
});
document.addEventListener('visibilitychange', () => { previousTime = performance.now(); });
initialize();
