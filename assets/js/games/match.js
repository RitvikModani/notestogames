// Memory Match — match each term to its definition against the clock.
import { el, clear, shuffle, confetti, resultPanel, toast } from '../ui.js';
import { sound } from '../sound.js';

export const meta = {
  id: 'match',
  name: 'Memory Match',
  icon: '🧩',
  tagline: 'Pair every term with its definition.',
  accent: 'blue',
  min: 3,
};

export function mount(root, cards, ctx) {
  const ROUND = Math.min(6, cards.length);
  let picks, matched, selected, moves, startTime, timerId;

  function setup() {
    const chosen = shuffle(cards).slice(0, ROUND);
    const tiles = [];
    chosen.forEach((c, idx) => {
      tiles.push({ pairId: idx, kind: 'term', text: c.term });
      tiles.push({ pairId: idx, kind: 'def', text: c.definition });
    });
    picks = shuffle(tiles);
    matched = new Set();
    selected = [];
    moves = 0;
    startTime = Date.now();
  }

  function finish() {
    clearInterval(timerId);
    const seconds = Math.round((Date.now() - startTime) / 1000);
    const score = Math.max(ROUND * 10, ROUND * 100 - moves * 5 - seconds);
    clear(root);
    sound.play('win');
    confetti();
    root.appendChild(
      resultPanel({
        score,
        total: ROUND * 100,
        message: `Matched all ${ROUND} pairs in ${seconds}s!`,
        onReplay: () => {
          setup();
          render();
          startTimer();
        },
        onExit: () => {
          clearInterval(timerId);
          ctx.onExit();
        },
      })
    );
    ctx.onComplete(score, ROUND * 100);
  }

  function onPick(idx) {
    if (matched.has(idx) || selected.includes(idx) || selected.length === 2) return;
    sound.play('select');
    selected.push(idx);
    renderTiles();
    if (selected.length === 2) {
      moves++;
      const [a, b] = selected;
      if (picks[a].pairId === picks[b].pairId) {
        matched.add(a);
        matched.add(b);
        selected = [];
        sound.play('match');
        renderTiles();
        if (matched.size === picks.length) setTimeout(finish, 350);
      } else {
        sound.play('wrong');
        setTimeout(() => {
          selected = [];
          renderTiles();
        }, 750);
      }
    }
  }

  function renderTiles() {
    const grid = root.querySelector('.match-grid');
    if (!grid) return;
    [...grid.children].forEach((node, idx) => {
      node.className = 'match-tile ' + picks[idx].kind;
      if (matched.has(idx)) node.classList.add('matched');
      else if (selected.includes(idx)) node.classList.add('selected');
    });
  }

  function startTimer() {
    clearInterval(timerId);
    timerId = setInterval(() => {
      const s = Math.round((Date.now() - startTime) / 1000);
      const t = root.querySelector('.match-timer');
      if (t) t.textContent = `⏱ ${s}s · ${moves} moves`;
    }, 500);
  }

  function render() {
    clear(root);
    root.appendChild(
      el('div.game-wrap', {}, [
        el('p.game-counter.match-timer', { text: '⏱ 0s · 0 moves' }),
        el(
          'div.match-grid',
          {},
          picks.map((tile, idx) =>
            el('button.match-tile', {
              class: tile.kind,
              onclick: () => onPick(idx),
              text: tile.text,
            })
          )
        ),
      ])
    );
    renderTiles();
  }

  setup();
  render();
  startTimer();
  toast('Tap a term, then its matching definition');
}
