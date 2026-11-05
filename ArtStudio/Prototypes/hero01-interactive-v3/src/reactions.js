import { ZONES_BY_ID } from './zones.js';

export const STATES = Object.freeze({
  IDLE: 'IDLE',
  TOUCH_REACTION: 'TOUCH_REACTION',
  SPECIAL_REACTION: 'SPECIAL_REACTION',
  RETURN_TO_IDLE: 'RETURN_TO_IDLE',
});

export const EXPRESSIONS = Object.freeze({
  neutral: { mouth: null, blush: 0, sleepy: 0 },
  happy: { mouth: 'happy', blush: 0.20, sleepy: 0 },
  surprised: { mouth: 'surprised', blush: 0.08, sleepy: 0 },
  shy: { mouth: 'shy', blush: 0.58, sleepy: 0 },
  blushing: { mouth: 'shy', blush: 1, sleepy: 0 },
  playful: { mouth: 'playful', blush: 0.23, sleepy: 0 },
  sleepy: { mouth: 'shy', blush: 0.12, sleepy: 1 },
  sad: { mouth: 'sad', blush: 0.05, sleepy: 0 },
});

const VARIANTS = Object.freeze({
  head: ['happy', 'sleepy', 'playful'],
  hair: ['sleepy', 'happy', 'shy'],
  face: ['surprised', 'shy', 'playful'],
  shoulderLeft: ['happy', 'playful'],
  shoulderRight: ['happy', 'shy'],
  armLeft: ['playful', 'surprised'],
  armRight: ['happy', 'surprised'],
  handLeft: ['shy', 'happy', 'playful'],
  handRight: ['happy', 'shy', 'playful'],
  upperTorso: ['blushing', 'shy'],
  waist: ['surprised', 'playful'],
  legLeft: ['surprised', 'sad'],
  legRight: ['sad', 'surprised'],
});

const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const ATTACK = 0.17;
const HOLD_END = 1.12;
const END = 1.95;
const RETIRE = 0.18;
export const COOLDOWN_SECONDS = 0.10;

function envelope(elapsed) {
  return smooth(elapsed / ATTACK) * (1 - smooth((elapsed - HOLD_END) / (END - HOLD_END)));
}

// No timers: a single monotonic animation clock advances all state. New taps
// immediately replace the target and fade the previous *bounded* motion out.
export class ReactionController {
  constructor() {
    this.state = STATES.IDLE;
    this.active = null;
    this.retiring = [];
    this.history = [];
    this.zoneCounts = Object.create(null);
    this.count = 0;
    this.lastAcceptedAt = -Infinity;
  }

  trigger(zone, now) {
    if (!ZONES_BY_ID[zone] || !Number.isFinite(now) || now < this.lastAcceptedAt || now - this.lastAcceptedAt < COOLDOWN_SECONDS) return null;
    const previous = this.sample(now);
    this.retiring = previous.contributions.slice(-2).map(part => ({
      zone: part.zone, amount: part.amount, started: now,
    }));
    this.history = this.history.filter(entry => now - entry.time <= 2.2);
    const repeated = this.history.filter(entry => entry.zone === zone && now - entry.time <= 1.6).length >= 2;
    const combo = this.history.filter(entry => now - entry.time <= 1.25).length >= 3;
    const special = repeated || combo;
    const index = this.zoneCounts[zone] || 0;
    this.zoneCounts[zone] = index + 1;
    const expression = repeated ? 'blushing' : combo ? 'playful' : VARIANTS[zone][index % VARIANTS[zone].length];
    this.history.push({ zone, time: now });
    if (this.history.length > 8) this.history.shift();
    this.count++;
    this.lastAcceptedAt = now;
    this.active = { zone, expression, started: now, special };
    this.state = special ? STATES.SPECIAL_REACTION : STATES.TOUCH_REACTION;
    return { zone, expression, special, count: this.count, label: ZONES_BY_ID[zone].label };
  }

  sample(now) {
    this.retiring = this.retiring.filter(part => now - part.started < RETIRE);
    const contributions = this.retiring.map(part => ({
      zone: part.zone,
      amount: part.amount * (1 - smooth((now - part.started) / RETIRE)),
    }));
    let expression = 'neutral';
    let zone = null;
    if (this.active) {
      const elapsed = Math.max(0, now - this.active.started);
      if (elapsed >= END) {
        this.active = null;
        this.state = STATES.IDLE;
      } else {
        zone = this.active.zone;
        const amount = envelope(elapsed);
        if (amount > 0) contributions.push({ zone, amount });
        expression = elapsed < HOLD_END + 0.40 ? this.active.expression : 'neutral';
        this.state = elapsed >= HOLD_END ? STATES.RETURN_TO_IDLE
          : this.active.special ? STATES.SPECIAL_REACTION : STATES.TOUCH_REACTION;
      }
    } else {
      this.state = STATES.IDLE;
    }
    return { state: this.state, expression, zone, contributions, count: this.count };
  }
}

// Switch through neutral, instead of stacking two incompatible mouth images.
// A later tap replaces the pending target rather than queuing stale reactions.
export class ExpressionMixer {
  constructor() {
    this.current = 'neutral';
    this.target = 'neutral';
    this.amount = 0;
  }
  setTarget(name) {
    this.target = Object.prototype.hasOwnProperty.call(EXPRESSIONS, name) ? name : 'neutral';
  }
  update(delta) {
    const dt = Math.max(0, Math.min(0.1, delta || 0));
    if (this.current !== this.target && this.current !== 'neutral') {
      this.amount = Math.max(0, this.amount - dt / 0.14);
      if (this.amount === 0) this.current = 'neutral';
    }
    if (this.current === 'neutral' && this.target !== 'neutral') this.current = this.target;
    if (this.current === this.target && this.current !== 'neutral') this.amount = Math.min(1, this.amount + dt / 0.20);
    if (this.current === 'neutral') this.amount = 0;
    return { name: this.current, amount: this.amount, ...EXPRESSIONS[this.current] };
  }
}
