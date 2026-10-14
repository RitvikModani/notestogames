// questions.js — generates a VARIETY of questions from study cards, with a
// difficulty dial. Every question carries its source card's term so the app can
// update spaced-repetition mastery from any mode.
import { shuffle, sample } from './ui.js';

const short = (s, n = 90) => (s.length > n ? s.slice(0, n - 1).trim() + '…' : s);

// Similarity for "hard" distractors — shared prefix + closeness in length makes
// decoys that are genuinely tempting (desirable difficulty).
function similarity(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  return pre * 3 - Math.abs(a.length - b.length);
}

function distractors(pool, correct, n, getText, difficulty) {
  const others = pool.filter((c) => getText(c) !== correct);
  if (difficulty === 'hard') {
    others.sort((x, y) => similarity(getText(y), correct) - similarity(getText(x), correct));
    return others.slice(0, n).map(getText);
  }
  return shuffle(others).slice(0, n).map(getText);
}

function mcq(card, prompt, promptLabel, correct, distract, kind) {
  const opts = shuffle([{ text: correct, correct: true }, ...distract.map((d) => ({ text: d, correct: false }))]);
  return { kind, prompt, promptLabel, options: opts, answer: correct, card, answerTerm: card.term };
}

export function buildQuestions(cards, { limit = 20, difficulty = 'medium', order, allowTyped = true } = {}) {
  const usable = (order || cards).filter((c) => c.term && c.definition);
  if (usable.length < 3) return [];
  const nDistract = difficulty === 'easy' ? 2 : 3; // 3 or 4 options
  const out = [];

  for (const card of usable) {
    // Hard: ~45% free-recall (type the answer) — recognition is weak for retention.
    if (allowTyped && difficulty === 'hard' && Math.random() < 0.45) {
      out.push({ kind: 'typed', prompt: card.definition, promptLabel: 'Type the term', answer: card.term, card, answerTerm: card.term, options: [] });
      continue;
    }
    const kinds = difficulty === 'easy' ? ['term', 'def'] : ['term', 'def', 'cloze', 'truefalse', 'oddterm'];
    const pool = kinds[Math.floor(Math.random() * kinds.length)];

    if (pool === 'term') {
      const d = distractors(usable, card.term, nDistract, (c) => c.term, difficulty);
      if (d.length >= 2) out.push(mcq(card, card.definition, 'Which term fits this?', card.term, d, 'term'));
    } else if (pool === 'def') {
      const d = distractors(usable, card.definition, nDistract, (c) => short(c.definition), difficulty);
      if (d.length >= 2) out.push(mcq(card, card.term, 'What does this mean?', short(card.definition), d, 'def'));
    } else if (pool === 'cloze' && card.cloze) {
      const d = distractors(usable.filter((c) => c.cloze), card.cloze.answer, nDistract, (c) => c.cloze.answer, difficulty).filter(Boolean);
      if (d.length >= 2) out.push(mcq(card, card.cloze.text, 'Complete the sentence', card.cloze.answer, d, 'cloze'));
    } else if (pool === 'truefalse') {
      const flip = Math.random() < 0.5;
      const others = usable.filter((c) => c !== card);
      if (flip && others.length) {
        const wrong = (difficulty === 'hard'
          ? others.sort((x, y) => similarity(y.definition, card.definition) - similarity(x.definition, card.definition))[0]
          : sample(others, 1)[0]);
        out.push({ kind: 'truefalse', prompt: `“${card.term}” means: ${short(wrong.definition)}`, promptLabel: 'True or False?', options: [{ text: 'True', correct: false }, { text: 'False', correct: true }], answer: 'False', card, answerTerm: card.term });
      } else {
        out.push({ kind: 'truefalse', prompt: `“${card.term}” means: ${short(card.definition)}`, promptLabel: 'True or False?', options: [{ text: 'True', correct: true }, { text: 'False', correct: false }], answer: 'True', card, answerTerm: card.term });
      }
    } else if (pool === 'oddterm') {
      const d = distractors(usable, card.definition, nDistract, (c) => short(c.definition), difficulty);
      if (d.length >= 2) out.push(mcq(card, `Which describes “${card.term}”?`, 'Choose the right description', short(card.definition), d, 'oddterm'));
    }
  }

  const shuffled = order ? out : shuffle(out);
  return shuffled.slice(0, limit);
}

export function factStatement(cards, card, difficulty = 'medium') {
  const others = cards.filter((c) => c !== card && c.definition);
  const fake = Math.random() < 0.5 && others.length;
  let def;
  if (fake) {
    def = (difficulty === 'hard'
      ? others.sort((x, y) => similarity(y.definition, card.definition) - similarity(x.definition, card.definition))[0]
      : sample(others, 1)[0]).definition;
  } else def = card.definition;
  return { term: card.term, statement: def, isReal: !fake };
}
