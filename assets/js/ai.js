// ai.js — OPTIONAL AI mode (bring-your-own-key). Generates higher-order
// questions (Bloom's: Apply / Analyze / Evaluate / Create) from the user's notes
// and grades open answers, using the free tier of Google Gemini.
//
// The key is stored only in this browser (localStorage) and the request goes
// straight from the browser to Google — nothing passes through any server of
// ours, so the app stays free to host. The offline engine remains the default.

const KEY = 'n2g.ai.key.v1';
const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash'];

export function getKey() {
  try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
}
export function setKey(k) {
  try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
export function aiAvailable() { return !!getKey(); }

async function callGemini(prompt, schema, temperature = 0.7) {
  const key = getKey();
  if (!key) throw new Error('no-key');
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
      ...(schema ? { responseSchema: schema } : {}),
    },
  };
  let lastErr;
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        if (res.status === 400 && /API key not valid/i.test(txt)) throw new Error('bad-key');
        if (res.status === 429) throw new Error('rate-limit');
        lastErr = new Error('http-' + res.status);
        continue; // try next model
      }
      const data = await res.json();
      const text = data && data.candidates && data.candidates[0] &&
        data.candidates[0].content && data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (!text) throw new Error('empty');
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      if (e.message === 'bad-key' || e.message === 'rate-limit') throw e;
    }
  }
  throw lastErr || new Error('ai-failed');
}

const BLOOM = {
  recall: 'recall a specific fact, term or definition directly stated in the notes',
  understand: 'explain, classify or identify the correct meaning of an idea in different words',
  apply: 'use a concept from the notes to solve a NEW problem or realistic scenario not stated verbatim',
  analyze: 'break ideas apart — compare, contrast, find relationships, or distinguish causes, parts or reasons',
  evaluate: 'make and justify a judgement, decision or critique using the concepts',
  create: 'propose, design or generate something new (an example, plan, hypothesis or explanation) using the concepts',
};

const QUESTION_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      level: { type: 'STRING' },
      type: { type: 'STRING' },          // "mcq" or "short"
      question: { type: 'STRING' },
      options: { type: 'ARRAY', items: { type: 'STRING' } },
      answer: { type: 'STRING' },
      explanation: { type: 'STRING' },
    },
    required: ['type', 'question', 'answer', 'explanation'],
  },
};

export async function generateQuestions({ notes, cards, pattern = 'apply', difficulty = 'medium', count = 6 }) {
  const level = BLOOM[pattern] ? pattern : 'apply';
  const source = (notes && notes.trim()) ||
    (cards || []).map((c) => `${c.term}: ${c.definition}`).join('\n');
  const material = source.slice(0, 7000);
  const wantShort = level === 'create';
  const prompt =
    `You write study questions for a student, grounded ONLY in their notes below.\n` +
    `Create EXACTLY ${count} "${level}"-level questions. "${level}" means: ${BLOOM[level]}.\n` +
    (wantShort
      ? `Use type "short" (open-ended; the student types a brief answer). Put a concise model answer in "answer".\n`
      : `Prefer type "mcq" with exactly 4 plausible "options" (one correct); the "answer" must be the exact text of the correct option. A few may be "short" if that fits better.\n`) +
    `Difficulty: ${difficulty}. Make them genuinely ${level}-level (not simple recall unless the level is recall). ` +
    `Keep each question self-contained. Add a 1-sentence "explanation". Set "level" to "${level}".\n\n` +
    `NOTES:\n${material}`;
  const out = await callGemini(prompt, QUESTION_SCHEMA, 0.8);
  if (!Array.isArray(out)) throw new Error('bad-response');
  // normalise
  return out
    .filter((q) => q && q.question && q.answer)
    .map((q) => ({
      level: q.level || level,
      kind: q.type === 'mcq' && Array.isArray(q.options) && q.options.length >= 2 ? 'mcq' : 'short',
      prompt: q.question,
      promptLabel: (q.level || level).toUpperCase(),
      options: Array.isArray(q.options) ? q.options : [],
      answer: q.answer,
      explanation: q.explanation || '',
    }))
    .slice(0, count);
}

const GRADE_SCHEMA = {
  type: 'OBJECT',
  properties: { correct: { type: 'BOOLEAN' }, feedback: { type: 'STRING' } },
  required: ['correct', 'feedback'],
};

export async function gradeAnswer({ question, expected, userAnswer }) {
  const prompt =
    `Grade a student's short answer. Be fair: accept answers that are essentially correct even if worded differently or brief.\n` +
    `Question: ${question}\nModel answer: ${expected}\nStudent answer: ${userAnswer}\n` +
    `Return whether the student's answer is correct, and one short sentence of feedback.`;
  return callGemini(prompt, GRADE_SCHEMA, 0.2);
}

// Friendly message for an error thrown by the calls above.
export function aiErrorMessage(e) {
  const m = e && e.message;
  if (m === 'no-key') return 'Add your free Gemini API key to use AI mode.';
  if (m === 'bad-key') return 'That API key was rejected. Double-check it in AI settings.';
  if (m === 'rate-limit') return 'Gemini free-tier rate limit hit — wait a moment and try again.';
  return 'Couldn\'t reach the AI (check your connection, or that the hosted site can call Google).';
}
