// Quiz (study tool) — a calm, self-paced multiple-choice review. No timer, no
// arcade: answer, see the right answer, move on at your own pace.
import { el, clear, confetti, resultPanel } from '../ui.js';
import { sound } from '../sound.js';
import { buildQuestions } from '../questions.js';

export const meta = { id: 'reviewquiz', name: 'Quiz', icon: '✍️', tagline: 'Self-paced review with instant feedback.', accent: 'amber', min: 4, kind: 'study' };

export function mount(root, cards, ctx) {
  let questions, i, score, answered;

  function start() { questions = buildQuestions(cards, { limit: 12 }); i = 0; score = 0; render(); }

  function finish() {
    clear(root);
    if (score >= Math.ceil(questions.length * 0.8)) { sound.play('win'); confetti(); }
    root.appendChild(resultPanel({
      score, total: questions.length, message: 'Quiz complete!',
      onReplay: start, onExit: ctx.onExit,
    }));
    ctx.onComplete(score, questions.length);
  }

  function choose(btn, opt, q) {
    if (answered) return;
    answered = true;
    if (opt.correct) { score++; sound.play('correct'); } else sound.play('wrong');
    [...root.querySelectorAll('.q-opt')].forEach((b) => { b.disabled = true; if (b.__correct) b.classList.add('correct'); });
    if (!opt.correct) btn.classList.add('wrong');
    const nextLabel = i + 1 >= questions.length ? 'See results →' : 'Next question →';
    root.querySelector('.rq-foot').appendChild(el('button.btn.btn-primary.rq-next', {
      text: nextLabel, onclick: () => { i++; if (i >= questions.length) finish(); else render(); },
    }));
  }

  function render() {
    answered = false;
    const q = questions[i];
    clear(root);
    root.appendChild(el('div.game-wrap', {}, [
      el('div.game-progress', {}, [el('div.game-progress-bar', { style: `width:${(i / questions.length) * 100}%` })]),
      el('p.game-counter', { text: `Question ${i + 1} of ${questions.length} · Score ${score}` }),
      el('div.q-card', {}, [el('span.q-label', { text: q.promptLabel }), el('div.q-prompt', { text: q.prompt })]),
      el('div.q-options', {}, q.options.map((opt) => {
        const b = el('button.q-opt', { onclick: (e) => choose(e.currentTarget, opt, q), text: opt.text });
        b.__correct = opt.correct;
        return b;
      })),
      el('div.rq-foot'),
    ]));
  }

  start();
}
