// Quiz (study tool) — self-paced review with instant feedback. Honours the
// deck's difficulty (Hard = free-recall typed answers), records mastery on every
// answer, and can focus on your weakest cards first.
import { el, clear, confetti, resultPanel, looseMatch, toast } from '../ui.js';
import { sound } from '../sound.js';
import { buildQuestions } from '../questions.js';
import { meme } from '../memes.js';

export const meta = { id: 'reviewquiz', name: 'Quiz', icon: '✍️', tagline: 'Self-paced review with instant feedback.', accent: 'amber', min: 4, kind: 'study' };

export function mount(root, cards, ctx) {
  const difficulty = ctx.difficulty || 'medium';
  let focusWeak = !!ctx.focusWeak;
  let questions, i, score, answered;

  function build() {
    questions = buildQuestions(cards, { limit: 12, difficulty, order: focusWeak ? ctx.weakOrder : undefined });
  }
  function start() { build(); i = 0; score = 0; render(); }

  function finish() {
    clear(root);
    if (score >= Math.ceil(questions.length * 0.8)) { sound.play('win'); confetti(); }
    root.appendChild(resultPanel({
      score, total: questions.length,
      message: `Quiz complete · ${difficulty} mode`,
      onReplay: start, onExit: ctx.onExit,
    }));
    ctx.onComplete(score, questions.length);
  }

  function record(q, correct) { if (ctx.onCard && q.answerTerm) ctx.onCard(q.answerTerm, correct); }
  function nextBtn() {
    const label = i + 1 >= questions.length ? 'See results →' : 'Next question →';
    root.querySelector('.rq-foot').appendChild(el('button.btn.btn-primary.rq-next', {
      text: label, onclick: () => { i++; if (i >= questions.length) finish(); else render(); },
    }));
  }

  function choose(btn, opt, q) {
    if (answered) return;
    answered = true;
    const correct = !!opt.correct;
    if (correct) { score++; sound.play('correct'); } else sound.play('wrong');
    meme.pop(correct);
    record(q, correct);
    [...root.querySelectorAll('.q-opt')].forEach((b) => { b.disabled = true; if (b.__correct) b.classList.add('correct'); });
    if (!correct) btn.classList.add('wrong');
    nextBtn();
  }

  function submitTyped(input, q) {
    if (answered) return;
    const val = input.value.trim();
    if (!val) { input.focus(); return; }
    answered = true;
    const correct = looseMatch(val, q.answer);
    if (correct) { score++; sound.play('correct'); } else sound.play('wrong');
    meme.pop(correct);
    record(q, correct);
    input.disabled = true;
    input.classList.add(correct ? 'correct' : 'wrong');
    const fb = root.querySelector('.rq-typed-fb');
    fb.className = 'rq-typed-fb show ' + (correct ? 'good' : 'bad');
    fb.innerHTML = correct ? '✓ Correct!' : `✗ Answer: <b>${q.answer}</b>`;
    nextBtn();
  }

  function render() {
    answered = false;
    const q = questions[i];
    clear(root);
    const foot = el('div.rq-foot');
    const body = [
      el('div.game-progress', {}, [el('div.game-progress-bar', { style: `width:${(i / questions.length) * 100}%` })]),
      el('p.game-counter', { text: `Question ${i + 1} of ${questions.length} · Score ${score} · ${difficulty}` }),
      el('div.q-card', {}, [el('span.q-label', { text: q.promptLabel }), el('div.q-prompt', { text: q.prompt })]),
    ];
    if (q.kind === 'typed') {
      const input = el('input.blank-input.rq-input', { type: 'text', placeholder: 'Type your answer…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (answered) { i++; if (i >= questions.length) finish(); else render(); } else submitTyped(input, q); } });
      body.push(input, el('div.rq-typed-fb'), el('button.btn.btn-primary', { text: 'Check', onclick: () => submitTyped(input, q) }), foot);
      root.appendChild(el('div.game-wrap', {}, body));
      setTimeout(() => input.focus(), 40);
    } else {
      body.push(el('div.q-options', {}, q.options.map((opt) => {
        const b = el('button.q-opt', { onclick: (e) => choose(e.currentTarget, opt, q), text: opt.text });
        b.__correct = opt.correct;
        return b;
      })), foot);
      root.appendChild(el('div.game-wrap', {}, body));
    }
  }

  start();
  if (focusWeak) toast('Focusing on your weakest cards', 'good');
}
