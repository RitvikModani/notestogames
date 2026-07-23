// ui.js — small DOM + effects helpers shared across games. Zero dependencies.

// Hyperscript-lite element builder: el('div.card', { onclick }, [children])
export function el(tag, props = {}, children = []) {
  const parts = tag.split(/(?=[.#])/);
  const node = document.createElement(parts[0] || 'div');
  for (const p of parts.slice(1)) {
    if (p[0] === '.') node.classList.add(p.slice(1));
    else if (p[0] === '#') node.id = p.slice(1);
  }
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className += ' ' + v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== false && v != null) {
      node.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample(arr, n, exclude) {
  const pool = shuffle(arr.filter((x) => x !== exclude));
  return pool.slice(0, n);
}

// Loose answer matching so students aren't punished for casing/whitespace/punctuation.
export function looseMatch(a, b) {
  const norm = (s) =>
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return norm(a) === norm(b);
}

let toastTimer;
export function toast(message, type = 'info') {
  let box = document.getElementById('toast');
  if (!box) {
    box = el('div#toast');
    document.body.appendChild(box);
  }
  box.textContent = message;
  box.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.className = 'toast'), 2200);
}

// Lightweight self-contained confetti burst (canvas). Called on wins.
export function confetti(duration = 1400) {
  const canvas = el('canvas.confetti-canvas');
  const ctx = canvas.getContext('2d');
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  document.body.appendChild(canvas);
  const colors = ['#ff5a5f', '#ffc93c', '#2ec4b6', '#4361ee', '#8a5cf6', '#1c1a2e'];
  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.3,
    r: 4 + Math.random() * 6,
    c: colors[(Math.random() * colors.length) | 0],
    vx: -2 + Math.random() * 4,
    vy: 2 + Math.random() * 4,
    rot: Math.random() * Math.PI,
    vr: -0.2 + Math.random() * 0.4,
  }));
  const start = performance.now();
  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
  window.addEventListener('resize', resize, { once: true });
}

// Standard "you finished" panel used by every game.
export function resultPanel({ score, total, best, onReplay, onExit, message }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 40 ? '👍' : '💪';
  return el('div.result-panel', {}, [
    el('div.result-emoji', { text: emoji }),
    el('h2', { text: message || 'Round complete!' }),
    el('p.result-score', { html: `You scored <b>${score}</b> / ${total} &nbsp;(${pct}%)` }),
    best != null ? el('p.result-best', { text: `Best: ${best}` }) : null,
    el('div.result-actions', {}, [
      el('button.btn.btn-primary', { onclick: onReplay, text: '↻ Play again' }),
      el('button.btn.btn-ghost', { onclick: onExit, text: 'Back to games' }),
    ]),
  ]);
}
