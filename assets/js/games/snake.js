// Recall Snake — classic snake, but you must steer into the lettered tile whose
// answer matches the clue. Eat the right one to grow; a wrong tile or a crash
// costs a life. Movement + recall.
import { el, clear, shuffle, sample, confetti, resultPanel, toast } from '../ui.js';
import { sound } from '../sound.js';

export const meta = {
  id: 'snake',
  name: 'Recall Snake',
  icon: '🐍',
  tagline: 'Slither to the answer that fits the clue.',
  accent: 'green',
  min: 4,
};

const COLS = 15, ROWS = 11, CELL = 42;
const W = COLS * CELL, H = ROWS * CELL;
const LETTERS = ['A', 'B', 'C', 'D'];

export function mount(root, cards, ctx) {
  const usable = cards.filter((c) => c.term && c.definition);
  const ROUNDS = Math.min(10, usable.length);
  let order, roundIdx, score, lives, snake, dir, nextDir, targets, tickId, dpr, canvas, g, ended, roundDone;

  function place(occupied) {
    let x, y, key;
    do { x = (Math.random() * COLS) | 0; y = (Math.random() * ROWS) | 0; key = x + ',' + y; }
    while (occupied.has(key));
    occupied.add(key);
    return { x, y };
  }

  function newRound() {
    const card = order[roundIdx];
    const opts = shuffle([{ text: card.term, correct: true }, ...sample(usable, 3, card).map((c) => ({ text: c.term, correct: false }))]);
    const occ = new Set(snake.map((s) => s.x + ',' + s.y));
    targets = opts.slice(0, 4).map((o, k) => ({ ...o, ...place(occ), letter: LETTERS[k] }));
    roundDone = false;
    setClue(card.definition, opts);
  }

  function setClue(text, opts) {
    const box = root.querySelector('.snake-clue-text');
    if (box) box.textContent = text;
    const legend = root.querySelector('.snake-legend');
    if (legend) {
      clear(legend);
      targets.forEach((t) => legend.appendChild(el('span.snake-leg', {}, [el('b', { text: t.letter }), document.createTextNode(' ' + t.text)])));
    }
  }

  function loseLife() {
    lives--;
    sound.play('wrong');
    if (lives <= 0) return finish(false);
    // reset snake, keep round
    snake = [{ x: 2, y: (ROWS / 2) | 0 }];
    dir = { x: 1, y: 0 }; nextDir = dir;
    const occ = new Set(snake.map((s) => s.x + ',' + s.y));
    targets.forEach((t) => { const p = place(occ); t.x = p.x; t.y = p.y; });
    updateHud();
  }

  function tick() {
    if (ended || roundDone) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS || snake.some((s) => s.x === head.x && s.y === head.y)) {
      loseLife();
      draw();
      return;
    }
    snake.unshift(head);
    const hit = targets.find((t) => t.x === head.x && t.y === head.y);
    if (hit) {
      if (hit.correct) {
        score += 100;
        sound.play('correct');
        roundDone = true;
        updateHud();
        draw();
        setTimeout(() => { roundIdx++; if (roundIdx >= ROUNDS) finish(true); else { newRound(); } }, 260);
        return; // keep tail (grow)
      } else {
        snake.pop();
        loseLife();
        draw();
        return;
      }
    } else {
      snake.pop();
    }
    draw();
  }

  function draw() {
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0f1119';
    g.fillRect(0, 0, W, H);
    // subtle grid
    g.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let i = 1; i < COLS; i++) { g.beginPath(); g.moveTo(i * CELL, 0); g.lineTo(i * CELL, H); g.stroke(); }
    for (let j = 1; j < ROWS; j++) { g.beginPath(); g.moveTo(0, j * CELL); g.lineTo(W, j * CELL); g.stroke(); }
    // targets
    const palette = { A: '#7c9cff', B: '#f0b45a', C: '#4fd1c5', D: '#f2698f' };
    for (const t of targets) {
      g.fillStyle = palette[t.letter];
      roundRect(t.x * CELL + 4, t.y * CELL + 4, CELL - 8, CELL - 8, 8);
      g.fill();
      g.fillStyle = '#12141c';
      g.font = '800 20px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t.letter, t.x * CELL + CELL / 2, t.y * CELL + CELL / 2 + 1);
    }
    // snake
    snake.forEach((s, i) => {
      g.fillStyle = i === 0 ? '#8ef2d0' : '#3fbfa3';
      roundRect(s.x * CELL + 3, s.y * CELL + 3, CELL - 6, CELL - 6, 7);
      g.fill();
    });
  }
  function roundRect(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function updateHud() {
    const l = root.querySelector('.snake-lives'); const s = root.querySelector('.snake-score'); const r = root.querySelector('.snake-round');
    if (l) l.textContent = '❤'.repeat(Math.max(0, lives));
    if (s) s.textContent = 'Score ' + score;
    if (r) r.textContent = `Clue ${Math.min(roundIdx + 1, ROUNDS)}/${ROUNDS}`;
  }

  function finish(win) {
    if (ended) return;
    ended = true;
    clearInterval(tickId);
    clear(root);
    if (win) { sound.play('win'); confetti(); }
    root.appendChild(resultPanel({
      score, total: ROUNDS * 100,
      message: win ? 'All clues cleared!' : 'Snake down!',
      onReplay: start, onExit: () => { clearInterval(tickId); ctx.onExit(); },
    }));
    ctx.onComplete(score, ROUNDS * 100);
  }

  function setDir(x, y) {
    if (dir.x === -x && dir.y === -y) return; // no reversing
    nextDir = { x, y };
  }
  function onKey(e) {
    const k = e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) e.preventDefault();
    if (k === 'ArrowUp' || k === 'w') setDir(0, -1);
    else if (k === 'ArrowDown' || k === 's') setDir(0, 1);
    else if (k === 'ArrowLeft' || k === 'a') setDir(-1, 0);
    else if (k === 'ArrowRight' || k === 'd') setDir(1, 0);
  }

  function start() {
    order = shuffle(usable).slice(0, ROUNDS);
    roundIdx = 0; score = 0; lives = 3; ended = false;
    snake = [{ x: 3, y: (ROWS / 2) | 0 }, { x: 2, y: (ROWS / 2) | 0 }];
    dir = { x: 1, y: 0 }; nextDir = dir;
    build();
    newRound();
    updateHud();
    draw();
    clearInterval(tickId);
    tickId = setInterval(tick, 150);
  }

  function build() {
    clear(root);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas = el('canvas.snake-canvas');
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.aspectRatio = `${W}/${H}`;
    g = canvas.getContext('2d'); g.scale(dpr, dpr);

    const pad = (label, x, y) => {
      const b = el('button.snake-pad', { text: label, 'aria-label': label });
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); setDir(x, y); });
      return b;
    };
    root.appendChild(el('div.game-wrap.snake-wrap', {}, [
      el('div.snake-hud', {}, [el('span.snake-lives'), el('span.snake-round'), el('span.snake-score')]),
      el('div.snake-clue', {}, [el('span.snake-clue-label', { text: 'CLUE' }), el('span.snake-clue-text')]),
      canvas,
      el('div.snake-legend'),
      el('div.snake-dpad', {}, [
        el('div', {}, [pad('▲', 0, -1)]),
        el('div.snake-dpad-mid', {}, [pad('◀', -1, 0), pad('▼', 0, 1), pad('▶', 1, 0)]),
      ]),
      el('p.bl-hint', { text: 'Move: arrow keys / WASD / swipe the D-pad' }),
    ]));
  }

  window.addEventListener('keydown', onKey);
  start();
  toast('Steer into the letter that matches the clue!');
  return function cleanup() { clearInterval(tickId); window.removeEventListener('keydown', onKey); };
}
