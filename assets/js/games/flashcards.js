// Flashcards — flip through cards and rate yourself. Builds recall + confidence.
import { el, clear, shuffle, confetti, resultPanel } from '../ui.js';

export const meta = {
  id: 'flashcards',
  name: 'Flashcards',
  icon: '🃏',
  tagline: 'Flip, recall, and mark what you know.',
  min: 1,
};

export function mount(root, cards, ctx) {
  let deck = shuffle(cards);
  let i = 0;
  let known = 0;
  let flipped = false;

  function finish() {
    clear(root);
    if (known === deck.length && deck.length > 1) confetti();
    root.appendChild(
      resultPanel({
        score: known,
        total: deck.length,
        message: 'Flashcards done!',
        onReplay: () => {
          deck = shuffle(cards);
          i = 0;
          known = 0;
          render();
        },
        onExit: ctx.onExit,
      })
    );
    ctx.onComplete(known, deck.length);
  }

  function next(gotIt) {
    if (gotIt) known++;
    i++;
    flipped = false;
    if (i >= deck.length) finish();
    else render();
  }

  function render() {
    clear(root);
    const card = deck[i];
    const inner = el('div.flip-inner', {}, [
      el('div.flip-face.flip-front', {}, [
        el('span.flip-label', { text: 'TERM' }),
        el('div.flip-text', { text: card.term }),
        el('span.flip-hint', { text: 'Tap to reveal' }),
      ]),
      el('div.flip-face.flip-back', {}, [
        el('span.flip-label', { text: 'DEFINITION' }),
        el('div.flip-text', { text: card.definition }),
      ]),
    ]);
    const flipCard = el('div.flashcard', { onclick: () => {
      flipped = !flipped;
      flipCard.classList.toggle('flipped', flipped);
    } }, [inner]);
    if (flipped) flipCard.classList.add('flipped');

    root.appendChild(
      el('div.game-wrap', {}, [
        el('div.game-progress', {}, [
          el('div.game-progress-bar', { style: `width:${(i / deck.length) * 100}%` }),
        ]),
        el('p.game-counter', { text: `Card ${i + 1} of ${deck.length}` }),
        flipCard,
        el('div.flash-actions', {}, [
          el('button.btn.btn-danger-soft', { onclick: () => next(false), text: '✗ Still learning' }),
          el('button.btn.btn-success-soft', { onclick: () => next(true), text: '✓ Got it' }),
        ]),
      ])
    );
  }

  render();
}
