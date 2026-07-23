// questions.js — generates a large VARIETY of questions from study cards.
// Shared by the quiz-style games so every round feels different.
import { shuffle, sample } from './ui.js';

// Each question: { kind, prompt, promptLabel, options:[{text, correct}], answer }
function mcq(prompt, promptLabel, correct, distractors, kind = 'mcq') {
  const opts = shuffle([{ text: correct, correct: true }, ...distractors.map((d) => ({ text: d, correct: false }))]);
  return { kind, prompt, promptLabel, options: opts, answer: correct };
}

const short = (s, n = 90) => (s.length > n ? s.slice(0, n - 1).trim() + '…' : s);

export function buildQuestions(cards, { limit = 20, kinds } = {}) {
  const usable = cards.filter((c) => c.term && c.definition);
  if (usable.length < 3) return [];
  const allKinds = kinds || ['term', 'def', 'cloze', 'truefalse', 'oddterm'];
  const out = [];

  for (const card of usable) {
    const others = usable.filter((c) => c !== card);
    const pool = allKinds[Math.floor(Math.random() * allKinds.length)];

    if (pool === 'term') {
      // Definition -> which term?
      const d = sample(others, 3).map((c) => c.term);
      if (d.length >= 2) out.push(mcq(card.definition, 'Which term fits this?', card.term, d, 'term'));
    } else if (pool === 'def') {
      // Term -> which definition?
      const d = sample(others, 3).map((c) => short(c.definition));
      if (d.length >= 2) out.push(mcq(card.term, 'What does this mean?', short(card.definition), d, 'def'));
    } else if (pool === 'cloze' && card.cloze) {
      // Fill the blank, multiple choice.
      const d = sample(others, 3).map((c) => c.cloze ? c.cloze.answer : c.term).filter(Boolean);
      if (d.length >= 2) out.push(mcq(card.cloze.text, 'Complete the sentence', card.cloze.answer, d, 'cloze'));
    } else if (pool === 'truefalse') {
      // Is this pairing correct?
      const flip = Math.random() < 0.5;
      if (flip && others.length) {
        const wrong = sample(others, 1)[0];
        out.push({
          kind: 'truefalse',
          prompt: `“${card.term}” means: ${short(wrong.definition)}`,
          promptLabel: 'True or False?',
          options: [{ text: 'True', correct: false }, { text: 'False', correct: true }],
          answer: 'False',
        });
      } else {
        out.push({
          kind: 'truefalse',
          prompt: `“${card.term}” means: ${short(card.definition)}`,
          promptLabel: 'True or False?',
          options: [{ text: 'True', correct: true }, { text: 'False', correct: false }],
          answer: 'True',
        });
      }
    } else if (pool === 'oddterm') {
      // Term -> definition, but phrased as "pick the correct description".
      const d = sample(others, 3).map((c) => short(c.definition));
      if (d.length >= 2) out.push(mcq(`Which describes “${card.term}”?`, 'Choose the right description', short(card.definition), d, 'oddterm'));
    }
  }

  return shuffle(out).slice(0, limit);
}

// A single quick true/false statement (for Fact or Fake).
export function factStatement(cards, card) {
  const others = cards.filter((c) => c !== card && c.definition);
  const fake = Math.random() < 0.5 && others.length;
  const def = fake ? sample(others, 1)[0].definition : card.definition;
  return { term: card.term, statement: def, isReal: !fake };
}
