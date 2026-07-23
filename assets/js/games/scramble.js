// Word Scramble — the term's letters are jumbled; rebuild it using the clue.
// A word-manipulation game (not a recall quiz): tap letters into the slots.
import { el, clear, shuffle, confetti, resultPanel } from '../ui.js';

export const meta = {
  id: 'scramble',
  name: 'Word Scramble',
  icon: '🔀',
  tagline: 'Unscramble the term from its clue.',
  accent: 'purple',
  min: 2,
};

export function mount(root, cards, ctx) {
  // Good scramble words are single, alphabetic terms.
  let items = shuffle(
    cards.filter((c) => c.term && /^[A-Za-z][A-Za-z-]{2,13}$/.test(c.term.trim()) && c.definition)
  );
  let i = 0;
  let score = 0;

  function finish() {
    clear(root);
    const total = items.length * 100;
    if (score >= total * 0.6) confetti();
    root.appendChild(
      resultPanel({
        score,
        total,
        message: 'Scramble solved!',
        onReplay: () => {
          items = shuffle(items);
          i = 0;
          score = 0;
          render();
        },
        onExit: ctx.onExit,
      })
    );
    ctx.onComplete(score, total);
  }

  function scrambleLetters(word) {
    const chars = word.replace(/-/g, '').split('');
    let out;
    let tries = 0;
    do {
      out = shuffle(chars);
      tries++;
    } while (out.join('') === chars.join('') && chars.length > 1 && tries < 20);
    return out;
  }

  function render() {
    clear(root);
    if (items.length === 0) {
      root.appendChild(
        el('div.game-wrap', {}, [
          el('p.empty-note', { text: 'No single-word terms in these notes for scrambling. Try Term Blaster or Word Guess!' }),
          el('button.btn.btn-ghost', { onclick: ctx.onExit, text: 'Back to games' }),
        ])
      );
      return;
    }

    const card = items[i];
    const answer = card.term.trim();
    const target = answer.replace(/-/g, '').toUpperCase();
    const bank = scrambleLetters(answer.toUpperCase()).map((ch, id) => ({ id, ch, used: false, locked: false }));
    const slots = Array.from({ length: target.length }, () => null); // holds bank id
    let hints = 0;
    let solved = false;

    const slotRow = el('div.sc-slots');
    const bankRow = el('div.sc-bank');
    const status = el('div.sc-status');

    function built() {
      return slots.map((id) => (id == null ? '' : bank[id].ch)).join('');
    }

    function firstEmpty() {
      return slots.findIndex((s) => s === null);
    }

    function place(bankId) {
      if (solved || bank[bankId].used) return;
      const slot = firstEmpty();
      if (slot < 0) return;
      slots[slot] = bankId;
      bank[bankId].used = true;
      afterMove();
    }

    function unplace(slotIdx) {
      if (solved) return;
      const id = slots[slotIdx];
      if (id == null || bank[id].locked) return;
      bank[id].used = false;
      slots[slotIdx] = null;
      afterMove();
    }

    function hint() {
      if (solved) return;
      // find first slot that is empty or wrong, fill with correct letter from an unused tile
      for (let s = 0; s < target.length; s++) {
        const cur = slots[s] == null ? '' : bank[slots[s]].ch;
        if (cur === target[s]) continue;
        // free the wrong tile
        if (slots[s] != null) {
          bank[slots[s]].used = false;
          slots[s] = null;
        }
        const tile = bank.find((t) => !t.used && t.ch === target[s]);
        if (tile) {
          slots[s] = tile.id;
          tile.used = true;
          tile.locked = true;
          hints++;
        }
        break;
      }
      afterMove();
    }

    function reveal() {
      if (solved) return;
      solved = true;
      status.className = 'sc-status show bad';
      status.innerHTML = `Answer: <b>${answer}</b>`;
      draw();
      nextButton('Next →', 0);
    }

    function afterMove() {
      draw();
      if (firstEmpty() < 0) {
        if (built() === target) {
          solved = true;
          const gained = Math.max(25, 100 - hints * 25);
          score += gained;
          status.className = 'sc-status show good';
          status.textContent = `✓ Correct!  +${gained}`;
          if (i + 1 >= items.length) confettiMaybe();
          nextButton(i + 1 >= items.length ? 'See results →' : 'Next →', gained);
        } else {
          status.className = 'sc-status show warn';
          status.textContent = 'Not quite — tap letters to rearrange.';
        }
      } else {
        status.className = 'sc-status';
        status.textContent = '';
      }
    }

    function confettiMaybe() {
      if (score >= items.length * 100 * 0.6) confetti();
    }

    let actionBtn;
    function nextButton(label) {
      if (actionBtn) actionBtn.remove();
      actionBtn = el('button.btn.btn-primary.sc-next', {
        text: label,
        onclick: () => {
          i++;
          if (i >= items.length) finish();
          else render();
        },
      });
      controls.appendChild(actionBtn);
    }

    function draw() {
      clear(slotRow);
      slots.forEach((id, idx) => {
        const filled = id != null;
        const t = el(
          'button.sc-slot' + (filled ? '.filled' : '') + (filled && bank[id].locked ? '.locked' : ''),
          { onclick: () => unplace(idx), text: filled ? bank[id].ch : '' }
        );
        slotRow.appendChild(t);
      });
      clear(bankRow);
      bank.forEach((tile) => {
        bankRow.appendChild(
          el('button.sc-tile' + (tile.used ? '.used' : ''), {
            disabled: tile.used || solved,
            onclick: () => place(tile.id),
            text: tile.ch,
          })
        );
      });
    }

    const controls = el('div.sc-controls', {}, [
      el('button.btn.btn-ghost', { onclick: () => bankReshuffle(), text: '🔀 Shuffle' }),
      el('button.btn.btn-ghost', { onclick: hint, text: '💡 Hint' }),
      el('button.btn.btn-ghost', { onclick: reveal, text: 'Reveal' }),
    ]);

    function bankReshuffle() {
      if (solved) return;
      const order = shuffle(bank.filter((t) => !t.used).map((t) => t.id));
      let k = 0;
      for (const t of bank) if (!t.used) t.sortKey = order[k++];
      bank.sort((a, b) => (a.used === b.used ? (a.sortKey ?? 0) - (b.sortKey ?? 0) : a.used ? 1 : -1));
      draw();
    }

    root.appendChild(
      el('div.game-wrap', {}, [
        el('div.game-progress', {}, [el('div.game-progress-bar', { style: `width:${(i / items.length) * 100}%` })]),
        el('p.game-counter', { text: `Word ${i + 1} of ${items.length} · Score ${score}` }),
        el('div.sc-clue', {}, [el('span.sc-clue-label', { text: 'CLUE' }), el('span', { text: card.definition })]),
        slotRow,
        status,
        bankRow,
        controls,
      ])
    );
    draw();
  }

  render();
}
