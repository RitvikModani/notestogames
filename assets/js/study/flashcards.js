// Flashcards (study tool) — self-paced flip review. Choose how many cards, focus
// your weakest first (spaced repetition), and every rating updates mastery.
import { el, clear, shuffle, confetti, resultPanel } from '../ui.js';
import { sound } from '../sound.js';
import { meme } from '../memes.js';

export const meta = { id: 'flashcards', name: 'Flashcards', icon: '🗂️', tagline: 'Flip through and rate what you know.', accent: 'sky', min: 1, kind: 'study' };

export function mount(root, allCards, ctx) {
  let count = ctx.flashcardCount || 0; // 0 = all
  let focusWeak = !!ctx.focusWeak;
  let deck = [], i = 0, known = 0, flipped = false, started = false;

  function buildDeck() {
    let base = focusWeak && ctx.weakOrder ? ctx.weakOrder.slice() : shuffle(allCards);
    if (count > 0) base = base.slice(0, count);
    deck = base;
  }

  // ---- Options screen ----
  function options() {
    clear(root);
    const counts = [10, 20, 0].filter((c) => c === 0 || c <= allCards.length || c === 10);
    const countRow = el('div.seg');
    const setCount = (c) => { count = c; renderOpts(); };
    function renderOpts() {
      clear(countRow);
      [[10, '10'], [20, '20'], [0, 'All']].forEach(([v, label]) => {
        if (v > 0 && v > allCards.length && v !== 10) return;
        countRow.appendChild(el('button.seg-btn' + (count === v ? '.on' : ''), { text: label, onclick: () => setCount(v) }));
      });
    }
    renderOpts();
    const weakToggle = el('button.toggle' + (focusWeak ? '.on' : ''), {
      onclick: (e) => { focusWeak = !focusWeak; e.currentTarget.classList.toggle('on', focusWeak); },
      html: '🎯 Focus weakest first',
    });
    root.appendChild(el('div.game-wrap.fc-opts', {}, [
      el('div.fc-opts-card', {}, [
        el('h3', { text: 'Flashcards' }),
        el('div.fc-opt-row', {}, [el('span', { text: 'How many cards' }), countRow]),
        el('div.fc-opt-row', {}, [el('span', { text: 'Order' }), weakToggle]),
        el('button.btn.btn-primary.fc-start', { onclick: () => { buildDeck(); started = true; i = 0; known = 0; flipped = false; render(); }, text: 'Start review →' }),
      ]),
    ]));
  }

  function finish() {
    clear(root);
    if (known === deck.length && deck.length > 2) confetti();
    root.appendChild(resultPanel({
      score: known, total: deck.length, message: 'Review complete!',
      onReplay: () => { buildDeck(); i = 0; known = 0; flipped = false; render(); },
      onExit: ctx.onExit,
    }));
    ctx.onComplete(known, deck.length);
  }

  function next(gotIt) {
    if (gotIt) known++;
    if (ctx.onCard) ctx.onCard(deck[i].term, gotIt);
    meme.pop(gotIt);
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
    if (!started) return;
    if (e.key === ' ') { e.preventDefault(); flip(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') next(flipped);
    else if (e.key === 'ArrowLeft' && i > 0) { i--; flipped = false; render(); }
  }
  window.addEventListener('keydown', onKey);

  // If launched from "Review weak cards", skip options and go straight in.
  if (ctx.focusWeak) { buildDeck(); started = true; render(); } else options();
  return function cleanup() { window.removeEventListener('keydown', onKey); };
}
