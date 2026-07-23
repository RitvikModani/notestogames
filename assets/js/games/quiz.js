// Quiz — auto-generated multiple-choice questions with distractors from the deck.
import { el, clear, shuffle, sample, confetti, resultPanel } from '../ui.js';

export const meta = {
  id: 'quiz',
  name: 'Quiz Blitz',
  icon: '⚡',
  tagline: 'Multiple-choice questions built from your notes.',
  min: 4,
};

// Build a mix of "definition -> term" and "term -> definition" questions.
function buildQuestions(cards) {
  const usable = cards.filter((c) => c.term && c.definition);
  const qs = [];
  for (const card of usable) {
    const askForTerm = Math.random() < 0.5;
    if (askForTerm) {
      const distractors = sample(usable, 3, card).map((c) => c.term);
      if (distractors.length < 2) continue;
      qs.push({
        prompt: card.definition,
        promptLabel: 'Which term matches this?',
        correct: card.term,
        options: shuffle([card.term, ...distractors]),
      });
    } else {
      const distractors = sample(usable, 3, card).map((c) => c.definition);
      if (distractors.length < 2) continue;
      qs.push({
        prompt: card.term,
        promptLabel: 'What does this mean?',
        correct: card.definition,
        options: shuffle([card.definition, ...distractors]),
      });
    }
  }
  return shuffle(qs).slice(0, 15);
}

export function mount(root, cards, ctx) {
  let questions = buildQuestions(cards);
  let i = 0;
  let score = 0;
  let locked = false;

  function finish() {
    clear(root);
    if (score === questions.length && questions.length > 2) confetti();
    root.appendChild(
      resultPanel({
        score,
        total: questions.length,
        message: 'Quiz complete!',
        onReplay: () => {
          questions = buildQuestions(cards);
          i = 0;
          score = 0;
          render();
        },
        onExit: ctx.onExit,
      })
    );
    ctx.onComplete(score, questions.length);
  }

  function choose(btn, option, q) {
    if (locked) return;
    locked = true;
    const correct = option === q.correct;
    if (correct) score++;
    btn.classList.add(correct ? 'correct' : 'wrong');
    [...root.querySelectorAll('.option')].forEach((b) => {
      b.disabled = true;
      if (b.dataset.opt === q.correct) b.classList.add('correct');
    });
    setTimeout(() => {
      i++;
      locked = false;
      if (i >= questions.length) finish();
      else render();
    }, correct ? 550 : 1050);
  }

  function render() {
    clear(root);
    const q = questions[i];
    root.appendChild(
      el('div.game-wrap', {}, [
        el('div.game-progress', {}, [
          el('div.game-progress-bar', { style: `width:${(i / questions.length) * 100}%` }),
        ]),
        el('p.game-counter', { text: `Question ${i + 1} of ${questions.length} · Score ${score}` }),
        el('div.quiz-prompt', {}, [
          el('span.quiz-prompt-label', { text: q.promptLabel }),
          el('div.quiz-prompt-text', { text: q.prompt }),
        ]),
        el(
          'div.quiz-options',
          {},
          q.options.map((opt) =>
            el('button.option', {
              'data-opt': opt,
              onclick: (e) => choose(e.currentTarget, opt, q),
              text: opt,
            })
          )
        ),
      ])
    );
  }

  render();
}
