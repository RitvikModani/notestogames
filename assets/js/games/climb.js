// Concept Climb — each correct answer scales you up the mountain and is worth
// more than the last; a wrong answer makes you slip and costs a rope. Reach the
// summit for a bonus. A risk/progression game.
import { el, clear, confetti, resultPanel } from '../ui.js';
import { sound } from '../sound.js';
import { buildQuestions } from '../questions.js';

export const meta = {
  id: 'climb',
  name: 'Concept Climb',
  icon: '🧗',
  tagline: 'Scale the mountain — each rung is worth more.',
  accent: 'teal',
  min: 4,
};

const RUNGS = 8;

export function mount(root, cards, ctx) {
  let questions, height, score, ropes, locked, ended;

  function rungValue(h) { return 100 + h * 50; }
  function total() { let t = 0; for (let h = 0; h < RUNGS; h++) t += rungValue(h); return t + 300; }

  function start() {
    questions = buildQuestions(cards, { limit: 60 });
    height = 0; score = 0; ropes = 3; locked = false; ended = false;
    render();
  }

  function finish(summit) {
    if (ended) return;
    ended = true;
    clear(root);
    if (summit) { sound.play('win'); confetti(1600); }
    root.appendChild(resultPanel({
      score, total: total(),
      message: summit ? '🏔️ Summit reached!' : `You climbed to rung ${height}/${RUNGS}`,
      onReplay: start, onExit: ctx.onExit,
    }));
    ctx.onComplete(score, total());
  }

  function choose(btn, opt) {
    if (locked || ended) return;
    locked = true;
    [...root.querySelectorAll('.q-opt')].forEach((b) => { b.disabled = true; if (b.__correct) b.classList.add('correct'); });
    if (opt.correct) {
      score += rungValue(height);
      height++;
      btn.classList.add('correct');
      sound.play('correct');
      setTimeout(() => {
        locked = false;
        if (height >= RUNGS) { score += 300; finish(true); }
        else render();
      }, 500);
    } else {
      ropes--;
      if (height > 0) height--;
      btn.classList.add('wrong');
      sound.play('wrong');
      setTimeout(() => { locked = false; if (ropes <= 0) finish(false); else render(); }, 700);
    }
  }

  function render() {
    const q = questions[(RUNGS - 1 - height + score) % questions.length] || questions[height % questions.length];
    clear(root);
    const track = el('div.climb-track');
    for (let h = RUNGS; h >= 0; h--) {
      const rung = el('div.climb-rung' + (h === height ? '.here' : '') + (h < height ? '.done' : ''));
      if (h === height) rung.appendChild(el('span.climb-figure', { text: '🧗' }));
      else if (h === RUNGS) rung.appendChild(el('span.climb-flag', { text: '🚩' }));
      track.appendChild(rung);
    }
    root.appendChild(el('div.game-wrap.climb-wrap', {}, [
      el('div.climb-hud', {}, [
        el('span', { html: `Rung <b>${height}</b>/${RUNGS}` }),
        el('span.climb-ropes', { text: '🪢'.repeat(Math.max(0, ropes)) }),
        el('span', { html: `<b>${score}</b> pts` }),
      ]),
      el('div.climb-layout', {}, [
        track,
        el('div.climb-q', {}, [
          el('div.q-card', {}, [el('span.q-label', { text: q.promptLabel }), el('div.q-prompt', { text: q.prompt })]),
          el('div.q-options', {}, q.options.map((opt) => {
            const b = el('button.q-opt', { onclick: (e) => choose(e.currentTarget, opt), text: opt.text });
            b.__correct = opt.correct;
            return b;
          })),
        ]),
      ]),
    ]));
  }

  start();
}
