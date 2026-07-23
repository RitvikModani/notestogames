// Time Attack — answer as many varied questions as you can before the clock runs
// out. Combo multiplier rewards streaks. Uses the full question-variety engine.
import { el, clear, confetti, resultPanel } from '../ui.js';
import { sound } from '../sound.js';
import { buildQuestions } from '../questions.js';

export const meta = {
  id: 'timeattack',
  name: 'Time Attack',
  icon: '⏱️',
  tagline: 'Beat the clock with rapid-fire questions.',
  accent: 'amber',
  min: 4,
};

const DURATION = 45;

export function mount(root, cards, ctx) {
  let questions, qi, score, attempts, combo, timeLeft, timerId, locked, ended;

  function start() {
    questions = buildQuestions(cards, { limit: 40 });
    qi = 0; score = 0; attempts = 0; combo = 0; timeLeft = DURATION; locked = false; ended = false;
    render();
    clearInterval(timerId);
    timerId = setInterval(tick, 100);
  }

  function tick() {
    timeLeft -= 0.1;
    if (timeLeft <= 0) { timeLeft = 0; finish(); }
    const bar = root.querySelector('.ta-time-bar');
    const num = root.querySelector('.ta-time-num');
    if (bar) bar.style.width = (timeLeft / DURATION) * 100 + '%';
    if (num) num.textContent = Math.ceil(timeLeft) + 's';
  }

  function finish() {
    if (ended) return;
    ended = true;
    clearInterval(timerId);
    const total = Math.max(1, attempts) * 100;
    clear(root);
    if (score >= total * 0.7) { sound.play('win'); confetti(); }
    root.appendChild(resultPanel({
      score, total,
      message: `${Math.round(score / 100)} correct — combo peak x${bestCombo}!`,
      onReplay: start,
      onExit: () => { clearInterval(timerId); ctx.onExit(); },
    }));
    ctx.onComplete(score, total);
  }

  let bestCombo = 0;
  function choose(btn, opt) {
    if (locked || ended) return;
    locked = true;
    attempts++;
    const good = opt.correct;
    if (good) {
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      score += 100 + (combo - 1) * 15;
      sound.play('correct');
    } else {
      combo = 0;
      timeLeft = Math.max(0, timeLeft - 2);
      sound.play('wrong');
    }
    [...root.querySelectorAll('.ta-opt')].forEach((b) => {
      b.disabled = true;
      if (b.__correct) b.classList.add('correct');
    });
    btn.classList.add(good ? 'correct' : 'wrong');
    setTimeout(() => {
      locked = false;
      qi++;
      if (qi >= questions.length) { start(); return; } // loop pool if exhausted before time
      if (!ended) render();
    }, good ? 260 : 620);
  }

  function render() {
    const q = questions[qi];
    clear(root);
    root.appendChild(el('div.game-wrap', {}, [
      el('div.ta-hud', {}, [
        el('span.ta-score', { html: `<b>${score}</b> pts` }),
        el('span.ta-combo' + (combo > 1 ? '.hot' : ''), { text: combo > 1 ? `🔥 x${combo}` : '' }),
        el('span.ta-time-num', { text: Math.ceil(timeLeft) + 's' }),
      ]),
      el('div.ta-timer', {}, [el('div.ta-time-bar', { style: `width:${(timeLeft / DURATION) * 100}%` })]),
      el('div.q-card', {}, [
        el('span.q-label', { text: q.promptLabel }),
        el('div.q-prompt', { text: q.prompt }),
      ]),
      el('div.q-options', {}, q.options.map((opt) => {
        const b = el('button.ta-opt.q-opt', { onclick: (e) => choose(e.currentTarget, opt), text: opt.text });
        b.__correct = opt.correct;
        return b;
      })),
    ]));
  }

  start();
  return function cleanup() { clearInterval(timerId); };
}
