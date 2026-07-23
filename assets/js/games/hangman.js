// Word Guess — hangman-style guessing of key terms, with the definition as a clue.
import { el, clear, shuffle, confetti, resultPanel, toast } from '../ui.js';

export const meta = {
  id: 'hangman',
  name: 'Word Guess',
  icon: '🔤',
  tagline: 'Guess the term letter by letter using its clue.',
  accent: 'red',
  min: 2,
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const MAX_MISSES = 7;

export function mount(root, cards, ctx) {
  // Only single, mostly-alphabetic terms make good guessing words.
  let words = shuffle(
    cards.filter((c) => c.term && /^[A-Za-z][A-Za-z\s-]{2,20}$/.test(c.term) && c.definition)
  );
  let i = 0;
  let score = 0;

  function finish() {
    clear(root);
    if (score >= Math.ceil(words.length * 0.7)) confetti();
    root.appendChild(
      resultPanel({
        score,
        total: words.length,
        message: 'Word round over!',
        onReplay: () => {
          words = shuffle(words);
          i = 0;
          score = 0;
          render();
        },
        onExit: ctx.onExit,
      })
    );
    ctx.onComplete(score, words.length);
  }

  function render() {
    clear(root);
    if (words.length === 0) {
      root.appendChild(
        el('div.game-wrap', {}, [
          el('p.empty-note', {
            text: 'No single-word terms found for this game. Try Quiz or Flashcards!',
          }),
          el('button.btn.btn-ghost', { onclick: ctx.onExit, text: 'Back to games' }),
        ])
      );
      return;
    }
    const card = words[i];
    const answer = card.term.toUpperCase();
    const guessed = new Set();
    let misses = 0;
    let done = false;

    const wordRow = el('div.hm-word');
    const keyboard = el('div.hm-keyboard');
    const status = el('div.hm-status');
    const hearts = el('div.hm-hearts');

    function refresh() {
      clear(wordRow);
      for (const ch of answer) {
        if (ch === ' ') wordRow.appendChild(el('span.hm-space'));
        else if (ch === '-') wordRow.appendChild(el('span.hm-letter.filled', { text: '-' }));
        else {
          wordRow.appendChild(
            el('span.hm-letter' + (guessed.has(ch) ? '.filled' : ''), {
              text: guessed.has(ch) ? ch : '',
            })
          );
        }
      }
      clear(hearts);
      for (let h = 0; h < MAX_MISSES; h++) {
        hearts.appendChild(el('span.hm-heart', { text: h < MAX_MISSES - misses ? '♥' : '♡' }));
      }
    }

    function checkEnd() {
      const revealed = [...answer].every((ch) => ch === ' ' || ch === '-' || guessed.has(ch));
      if (revealed) {
        done = true;
        score++;
        status.className = 'hm-status good show';
        status.textContent = '✓ Solved!';
        confettiMaybe();
        advance();
      } else if (misses >= MAX_MISSES) {
        done = true;
        status.className = 'hm-status bad show';
        status.innerHTML = `✗ It was <b>${card.term}</b>`;
        advance();
      }
    }

    function confettiMaybe() {
      if (i + 1 >= words.length && score === words.length) confetti();
    }

    function advance() {
      [...keyboard.children].forEach((b) => (b.disabled = true));
      setTimeout(() => {
        i++;
        if (i >= words.length) finish();
        else render();
      }, 1200);
    }

    function guess(ch, btn) {
      if (done || guessed.has(ch)) return;
      if (answer.includes(ch)) {
        guessed.add(ch);
        btn.classList.add('hit');
      } else {
        misses++;
        btn.classList.add('miss');
      }
      btn.disabled = true;
      refresh();
      checkEnd();
    }

    for (const ch of LETTERS) {
      keyboard.appendChild(
        el('button.hm-key', { onclick: (e) => guess(ch, e.currentTarget), text: ch })
      );
    }

    root.appendChild(
      el('div.game-wrap', {}, [
        el('div.game-progress', {}, [
          el('div.game-progress-bar', { style: `width:${(i / words.length) * 100}%` }),
        ]),
        el('p.game-counter', { text: `Word ${i + 1} of ${words.length} · Score ${score}` }),
        el('div.hm-clue', {}, [el('span.hm-clue-label', { text: 'CLUE' }), el('span', { text: card.definition })]),
        hearts,
        wordRow,
        status,
        keyboard,
      ])
    );
    refresh();
  }

  render();
  toast('Guess the term from its clue!');
}
