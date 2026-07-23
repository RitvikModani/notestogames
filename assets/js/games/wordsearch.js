// Word Search — hide the key terms in a letter grid; the clues are their
// definitions. Drag across letters to find each term. Search / spatial recall.
import { el, clear, shuffle, confetti, resultPanel, toast } from '../ui.js';
import { sound } from '../sound.js';

export const meta = {
  id: 'wordsearch',
  name: 'Word Search',
  icon: '🔍',
  tagline: 'Hunt the hidden terms using their clues.',
  accent: 'indigo',
  min: 3,
};

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]];
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function mount(root, cards, ctx) {
  const candidates = cards
    .filter((c) => /^[A-Za-z]{3,10}$/.test((c.term || '').trim()) && c.definition)
    .map((c) => ({ word: c.term.trim().toUpperCase(), clue: c.definition, term: c.term.trim() }));

  function start() {
    clear(root);
    if (candidates.length < 3) {
      root.appendChild(el('div.game-wrap', {}, [
        el('p.empty-note', { text: 'Need at least 3 single-word terms for Word Search. Try Term Blaster or Time Attack!' }),
        el('button.btn.btn-ghost', { onclick: ctx.onExit, text: 'Back to games' }),
      ]));
      return;
    }
    const picked = shuffle(candidates).slice(0, 7);
    const size = Math.min(13, Math.max(9, Math.max(...picked.map((p) => p.word.length)) + 2));
    const grid = Array.from({ length: size }, () => Array(size).fill(null));
    const placed = [];

    for (const item of picked) {
      for (let attempt = 0; attempt < 80; attempt++) {
        const [dr, dc] = DIRS[(Math.random() * DIRS.length) | 0];
        const len = item.word.length;
        const r0 = (Math.random() * size) | 0;
        const c0 = (Math.random() * size) | 0;
        const rEnd = r0 + dr * (len - 1);
        const cEnd = c0 + dc * (len - 1);
        if (rEnd < 0 || rEnd >= size || cEnd < 0 || cEnd >= size) continue;
        let ok = true;
        const cells = [];
        for (let k = 0; k < len; k++) {
          const r = r0 + dr * k, c = c0 + dc * k;
          if (grid[r][c] && grid[r][c] !== item.word[k]) { ok = false; break; }
          cells.push([r, c]);
        }
        if (!ok) continue;
        cells.forEach(([r, c], k) => (grid[r][c] = item.word[k]));
        placed.push({ ...item, cells, found: false });
        break;
      }
    }
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!grid[r][c]) grid[r][c] = A[(Math.random() * 26) | 0];

    renderBoard(grid, size, placed.filter((p) => p.cells));
  }

  function renderBoard(grid, size, words) {
    clear(root);
    const found = new Set(); // "r,c" of permanently found cells
    let sel = [];
    let pressing = false;
    let startCell = null;

    const board = el('div.ws-board', { style: `grid-template-columns:repeat(${size},1fr)` });
    const cellEls = {};
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      const cell = el('button.ws-cell', { 'data-r': r, 'data-c': c, text: grid[r][c] });
      cellEls[r + ',' + c] = cell;
      board.appendChild(cell);
    }

    const cluesEl = el('ul.ws-clues', {}, words.map((w, idx) =>
      el('li.ws-clue', { 'data-w': idx }, [el('span.ws-clue-text', { text: w.clue })])
    ));

    function cellFromPoint(x, y) {
      const t = document.elementFromPoint(x, y);
      return t && t.classList.contains('ws-cell') ? t : null;
    }
    function lineBetween(a, b) {
      const [r1, c1] = a, [r2, c2] = b;
      const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
      const len = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) + 1;
      const straight = r1 === r2 || c1 === c2 || Math.abs(r2 - r1) === Math.abs(c2 - c1);
      if (!straight) return null;
      const path = [];
      for (let k = 0; k < len; k++) path.push([r1 + dr * k, c1 + dc * k]);
      return path;
    }
    function paint() {
      Object.values(cellEls).forEach((el2) => el2.classList.remove('sel'));
      sel.forEach(([r, c]) => cellEls[r + ',' + c].classList.add('sel'));
    }
    function commit() {
      if (sel.length > 1) {
        const letters = sel.map(([r, c]) => grid[r][c]).join('');
        const rev = letters.split('').reverse().join('');
        const hit = words.find((w) => !w.found && (w.word === letters || w.word === rev));
        if (hit) {
          hit.found = true;
          sound.play('match');
          sel.forEach(([r, c]) => { found.add(r + ',' + c); cellEls[r + ',' + c].classList.add('found'); });
          const li = cluesEl.querySelector(`[data-w="${words.indexOf(hit)}"]`);
          if (li) { li.classList.add('done'); li.querySelector('.ws-clue-text').textContent = hit.term + ' — ' + hit.clue; }
          if (words.every((w) => w.found)) setTimeout(win, 400);
        } else sound.play('wrong');
      }
      sel = [];
      paint();
    }

    board.addEventListener('pointerdown', (e) => {
      const cell = e.target.closest('.ws-cell');
      if (!cell) return;
      e.preventDefault();
      pressing = true;
      startCell = [+cell.dataset.r, +cell.dataset.c];
      sel = [startCell];
      paint();
    });
    board.addEventListener('pointermove', (e) => {
      if (!pressing) return;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (!cell) return;
      const path = lineBetween(startCell, [+cell.dataset.r, +cell.dataset.c]);
      if (path) { sel = path; paint(); }
    });
    const endPress = () => { if (pressing) { pressing = false; commit(); } };
    board.addEventListener('pointerup', endPress);
    board.addEventListener('pointerleave', endPress);

    let done = false;
    function win() {
      if (done) return;
      done = true;
      sound.play('win');
      confetti();
      clear(root);
      root.appendChild(resultPanel({
        score: words.length * 100, total: words.length * 100,
        message: `Found all ${words.length} terms!`,
        onReplay: start, onExit: ctx.onExit,
      }));
      ctx.onComplete(words.length * 100, words.length * 100);
    }

    root.appendChild(el('div.game-wrap.ws-wrap', {}, [
      el('p.game-counter', { text: 'Drag across letters to find each term' }),
      el('div.ws-layout', {}, [board, el('div.ws-cluebox', {}, [el('h4.ws-clues-title', { text: 'Find these' }), cluesEl])]),
    ]));
  }

  start();
  toast('Drag across letters — clues are on the side');
}
