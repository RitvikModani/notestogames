// Flashcards (study tool) — self-paced flip review. Not an arcade game: calm,
// keyboard-friendly, rate yourself and track what you know.
import { el, clear, shuffle, confetti, resultPanel } from '../ui.js';
import { sound } from '../sound.js';

export const meta = { id: 'flashcards', name: 'Flashcards', icon: '🗂️', tagline: 'Flip through and rate what you know.', accent: 'sky', min: 1, kind: 'study' };

export function mount(root, cards, ctx) {
  let deck = shuffle(cards);
  let i = 0, known = 0, flipped = false;

  function finish() {
    clear(root);
    if (known === deck.length && deck.length > 2) confetti();
    root.appendChild(resultPanel({
      score: known, total: deck.length, message: 'Review complete!',
      onReplay: () => { deck = shuffle(cards); i = 0; known = 0; flipped = false; render(); },
      onExit: ctx.onExit,
    }));
    ctx.onComplete(known, deck.length);
  }

  function next(gotIt) {
    if (gotIt) known++;
    sound.play(gotIt ? 'correct' : 'select');
    i++; flipped = false;
    if (i >= deck.length) finish(); else render();
  }

  function flip() { flipped = !flipped; sound.play('flip'); const c = root.querySelector('.fc-card'); if (c) c.classList.toggle('flipped', flipped); }

  function render() {
    clear(root);
    const card = deck[i];
    const inner = el('div.fc-inner', {}, [
      el('div.fc-face.fc-front', {}, [el('span.fc-label', { text: 'TERM' }), el('div.fc-text', { text: card.term }), el('span.fc-hint', { text: 'click or press Space to flip' })]),
      el('div.fc-face.fc-back', {}, [el('span.fc-label', { text: 'DEFINITION' }), el('div.fc-text', { text: card.definition })]),
    ]);
    const fc = el('div.fc-card' + (flipped ? '.flipped' : ''), { onclick: flip }, [inner]);
    root.appendChild(el('div.game-wrap', {}, [
      el('div.game-progress', {}, [el('div.game-progress-bar', { style: `width:${(i / deck.length) * 100}%` })]),
      el('p.game-counter', { text: `Card ${i + 1} of ${deck.length} · ${known} known` }),
      fc,
      el('div.fc-actions', {}, [
        el('button.btn.fc-no', { onclick: () => next(false), text: '↻ Still learning' }),
        el('button.btn.fc-yes', { onclick: () => next(true), text: '✓ Got it' }),
      ]),
    ]));
  }

  function onKey(e) {
    if (e.key === ' ') { e.preventDefault(); flip(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') next(flipped);
    else if (e.key === 'ArrowLeft' && i > 0) { i--; flipped = false; render(); }
  }
  window.addEventListener('keydown', onKey);
  render();
  return function cleanup() { window.removeEventListener('keydown', onKey); };
}
