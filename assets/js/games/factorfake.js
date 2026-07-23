// Fact or Fake — a definition is shown for a term, but it might be a decoy
// swapped in from another card. Decide fast: real or fake? A judgment game.
import { el, clear, shuffle, confetti, resultPanel } from '../ui.js';
import { sound } from '../sound.js';
import { factStatement } from '../questions.js';

export const meta = {
  id: 'factorfake',
  name: 'Fact or Fake',
  icon: '🕵️',
  tagline: 'Spot the fake definition before it fools you.',
  accent: 'rose',
  min: 4,
};

export function mount(root, cards, ctx) {
  const usable = cards.filter((c) => c.term && c.definition);
  const ROUNDS = Math.min(12, usable.length);
  let order, i, score, locked;

  function start() {
    order = shuffle(usable).slice(0, ROUNDS);
    i = 0; score = 0; locked = false;
    render();
  }

  function finish() {
    clear(root);
    if (score >= Math.ceil(ROUNDS * 0.7)) { sound.play('win'); confetti(); }
    root.appendChild(resultPanel({
      score, total: ROUNDS,
      message: `You caught ${score}/${ROUNDS} correctly!`,
      onReplay: start, onExit: ctx.onExit,
    }));
    ctx.onComplete(score, ROUNDS);
  }

  function answer(saidReal, fact, realBtn, fakeBtn) {
    if (locked) return;
    locked = true;
    const correct = saidReal === fact.isReal;
    if (correct) { score++; sound.play('correct'); } else sound.play('wrong');
    const verdict = el('div.ff-verdict.show ' + (correct ? 'good' : 'bad'), {
      html: correct
        ? `✓ Correct — that definition was <b>${fact.isReal ? 'real' : 'fake'}</b>`
        : `✗ Nope — it was <b>${fact.isReal ? 'real' : 'fake'}</b>`,
    });
    realBtn.disabled = true; fakeBtn.disabled = true;
    (fact.isReal ? realBtn : fakeBtn).classList.add('is-answer');
    root.querySelector('.ff-panel').appendChild(verdict);
    setTimeout(() => { i++; if (i >= ROUNDS) finish(); else render(); }, 900);
  }

  function render() {
    clear(root);
    const fact = factStatement(usable, order[i]);
    const realBtn = el('button.ff-btn.ff-real', { text: '✓ Real' });
    const fakeBtn = el('button.ff-btn.ff-fake', { text: '✕ Fake' });
    realBtn.onclick = () => answer(true, fact, realBtn, fakeBtn);
    fakeBtn.onclick = () => answer(false, fact, realBtn, fakeBtn);
    root.appendChild(el('div.game-wrap', {}, [
      el('div.game-progress', {}, [el('div.game-progress-bar', { style: `width:${(i / ROUNDS) * 100}%` })]),
      el('p.game-counter', { text: `Card ${i + 1} of ${ROUNDS} · Score ${score}` }),
      el('div.ff-panel', {}, [
        el('div.ff-term', { text: fact.term }),
        el('div.ff-claim-label', { text: 'CLAIMED DEFINITION' }),
        el('div.ff-claim', { text: fact.statement }),
      ]),
      el('div.ff-actions', {}, [fakeBtn, realBtn]),
    ]));
  }

  start();
}
