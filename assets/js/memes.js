// memes.js — self-contained meme reactions on right/wrong. No external images
// (those are blocked in the artifact and wouldn't be free/offline); instead we
// use meme-culture captions + big emoji, rendered as a quick animated sticker.

const WIN = [
  ['🧠', 'BIG BRAIN'],
  ['📈', 'STONKS'],
  ['🗿', 'absolutely based'],
  ['🔥', 'he\'s cooking'],
  ['💯', 'certified W'],
  ['😎', 'too easy'],
  ['🎯', 'bullseye'],
  ['🤯', 'actually insane'],
  ['🏆', 'built different'],
  ['⚡', 'no notes needed'],
];
const LOSE = [
  ['💀', 'it\'s so over'],
  ['🤡', 'bonk'],
  ['📉', 'not stonks'],
  ['🧱', 'skill issue'],
  ['😭', 'so close'],
  ['🫠', 'it\'s cooked'],
  ['🙃', 'we move'],
  ['📚', 'back to the notes'],
  ['🪦', 'F'],
  ['👻', 'ghosted that one'],
];

const TIERS = [
  [95, '🐐', 'GOAT. Actual genius.'],
  [80, '🔥', 'Cracked. You\'re cooking.'],
  [60, '😎', 'Solid W.'],
  [40, '📈', 'Trending up — keep going.'],
  [0, '💪', 'Respawn and run it back.'],
];

// Plain (memes-off) captions for result screens.
const PLAIN = [
  [95, '🏆', 'Outstanding!'],
  [80, '🎉', 'Great work!'],
  [60, '👍', 'Nicely done.'],
  [40, '🙂', 'Good progress.'],
  [0, '💪', 'Keep practising.'],
];

const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const MEME_KEY = 'n2g.memes.v1';
let enabled = true;
try { enabled = localStorage.getItem(MEME_KEY) !== '0'; } catch (e) { /* ignore */ }

let node = null;
let timer = null;

export const meme = {
  isOn() { return enabled; },
  toggle() {
    enabled = !enabled;
    try { localStorage.setItem(MEME_KEY, enabled ? '1' : '0'); } catch (e) { /* ignore */ }
    return enabled;
  },
  pop(correct) {
    if (!enabled) return;
    const [emoji, caption] = pick(correct ? WIN : LOSE);
    if (!node) {
      node = document.createElement('div');
      node.className = 'meme-pop';
      document.body.appendChild(node);
    }
    node.className = 'meme-pop ' + (correct ? 'win' : 'lose');
    node.innerHTML = `<span class="meme-emoji">${emoji}</span><span class="meme-cap">${caption}</span>`;
    // restart animation
    node.style.animation = 'none';
    // force reflow so the animation re-triggers
    void node.offsetWidth;
    node.style.animation = reduce() ? 'memeFade 1.1s ease forwards' : '';
    node.classList.remove('show');
    void node.offsetWidth;
    node.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => { if (node) node.classList.remove('show'); }, 1050);
  },
  forScore(pct) {
    const table = enabled ? TIERS : PLAIN;
    for (const [min, emoji, caption] of table) if (pct >= min) return { emoji, caption };
    return { emoji: '💪', caption: enabled ? 'Run it back.' : 'Keep going.' };
  },
};
