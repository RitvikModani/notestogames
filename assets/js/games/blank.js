// Fill in the Blank — type the missing key word from a sentence in your notes.
import { el, clear, shuffle, looseMatch, confetti, resultPanel } from '../ui.js';

export const meta = {
  id: 'blank',
  name: 'Fill the Blank',
  icon: '✏️',
  tagline: 'Recall the missing word from your notes.',
  min: 2,
};

export function mount(root, cards, ctx) {
  let items = shuffle(cards.filter((c) => c.cloze && c.cloze.answer));
  let i = 0;
  let score = 0;

  function finish() {
    clear(root);
    if (score === items.length && items.length > 1) confetti();
    root.appendChild(
      resultPanel({
        score,
        total: items.length,
        message: 'All blanks filled!',
        onReplay: () => {
          items = shuffle(items);
          i = 0;
          score = 0;
          render();
        },
        onExit: ctx.onExit,
      })
    );
    ctx.onComplete(score, items.length);
  }

  function render() {
    clear(root);
    if (items.length === 0) {
      root.appendChild(
        el('div.game-wrap', {}, [
          el('p.empty-note', {
            text: 'These notes don\'t have enough sentence context for this game. Try Flashcards or Quiz instead!',
          }),
          el('button.btn.btn-ghost', { onclick: ctx.onExit, text: 'Back to games' }),
        ])
      );
      return;
    }
    const item = items[i];
    const cloze = item.cloze;
    let answered = false;

    const input = el('input.blank-input', {
      type: 'text',
      placeholder: 'Type the missing word…',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
    });
    const feedback = el('div.blank-feedback');

    function submit() {
      if (answered) {
        i++;
        if (i >= items.length) finish();
        else render();
        return;
      }
      const val = input.value.trim();
      if (!val) {
        input.focus();
        return;
      }
      answered = true;
      const correct = looseMatch(val, cloze.answer);
      if (correct) score++;
      input.disabled = true;
      input.classList.add(correct ? 'correct' : 'wrong');
      feedback.className = 'blank-feedback show ' + (correct ? 'good' : 'bad');
      feedback.innerHTML = correct
        ? '✓ Correct!'
        : `✗ Answer: <b>${cloze.answer}</b>`;
      btn.textContent = i + 1 >= items.length ? 'See results →' : 'Next →';
    }

    const btn = el('button.btn.btn-primary', { onclick: submit, text: 'Check' });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });

    root.appendChild(
      el('div.game-wrap', {}, [
        el('div.game-progress', {}, [
          el('div.game-progress-bar', { style: `width:${(i / items.length) * 100}%` }),
        ]),
        el('p.game-counter', { text: `Blank ${i + 1} of ${items.length} · Score ${score}` }),
        el('div.blank-sentence', { html: cloze.text.replace('_____', '<span class="blank-slot">_____</span>') }),
        input,
        feedback,
        btn,
      ])
    );
    setTimeout(() => input.focus(), 50);
  }

  render();
}
