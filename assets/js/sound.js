// sound.js — a tiny self-contained arcade sound + haptics engine.
// Uses the Web Audio API to synthesize blips on the fly, so there are no audio
// files to download (keeps the site free, fast and offline-friendly).

const MUTE_KEY = 'n2g.muted.v1';
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch (e) { /* ignore */ }

function ac() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// One synth voice: a frequency that can glide, with an attack/decay envelope.
function voice(freq, { dur = 0.12, type = 'square', gain = 0.05, to = null, delay = 0 } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function buzz(pattern) {
  if (muted) return;
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }
}

const RECIPES = {
  click: () => voice(300, { dur: 0.06, type: 'triangle', gain: 0.035 }),
  select: () => voice(440, { dur: 0.07, type: 'triangle', gain: 0.04 }),
  flip: () => voice(520, { dur: 0.08, type: 'sine', gain: 0.04, to: 660 }),
  shoot: () => { voice(720, { dur: 0.09, type: 'square', gain: 0.03, to: 240 }); },
  correct: () => {
    voice(523, { dur: 0.1, type: 'square', gain: 0.045 });
    voice(784, { dur: 0.12, type: 'square', gain: 0.045, delay: 0.09 });
    buzz(18);
  },
  wrong: () => { voice(200, { dur: 0.22, type: 'sawtooth', gain: 0.045, to: 90 }); buzz([28, 40, 28]); },
  match: () => { voice(660, { dur: 0.09, type: 'square', gain: 0.045, to: 990 }); buzz(15); },
  win: () => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => voice(n, { dur: 0.16, type: 'square', gain: 0.05, delay: i * 0.1 }));
    buzz([20, 40, 20, 40, 60]);
  },
};

export const sound = {
  play(name) {
    const r = RECIPES[name];
    if (r) r();
  },
  isMuted() { return muted; },
  toggle() {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (!muted) this.play('select'); // audible confirmation when turning on
    return muted;
  },
};
