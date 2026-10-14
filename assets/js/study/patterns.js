// Pattern Practice (study tool) — drill specific question patterns by Bloom's
// level. Recall & Understand run on the free offline engine; Apply, Analyze,
// Evaluate & Create use AI mode (your own free Gemini key) for genuine
// higher-order questions, with AI grading of open answers.
import { el, clear, shuffle, looseMatch, confetti, resultPanel, toast } from '../ui.js';
import { sound } from '../sound.js';
import { meme } from '../memes.js';
import { buildQuestions } from '../questions.js';
import { aiAvailable, generateQuestions, gradeAnswer, aiErrorMessage } from '../ai.js';

export const meta = { id: 'patterns', name: 'Pattern Practice', icon: '🎛️', tagline: 'Drill Apply, Analyze & Create — not just recall.', accent: 'pink', min: 3, kind: 'study' };

const PATTERNS = [
  { id: 'recall', name: 'Recall', icon: '🧠', desc: 'Facts & definitions', ai: false },
  { id: 'understand', name: 'Understand', icon: '💡', desc: 'Explain the idea', ai: false },
  { id: 'apply', name: 'Apply', icon: '🛠️', desc: 'Use it on a new problem', ai: true },
  { id: 'analyze', name: 'Analyze', icon: '🔍', desc: 'Compare, relate, break down', ai: true },
  { id: 'evaluate', name: 'Evaluate', icon: '⚖️', desc: 'Judge & justify', ai: true },
  { id: 'create', name: 'Create', icon: '✨', desc: 'Design something new', ai: true },
];

export function mount(root, cards, ctx) {
  const difficulty = ctx.difficulty || 'medium';

  function chooser() {
    clear(root);
    const grid = el('div.pat-grid');
    for (const pat of PATTERNS) {
      const locked = pat.ai && !aiAvailable();
      grid.appendChild(el('button.pat-card' + (locked ? '.locked' : ''), {
        onclick: () => (locked ? promptAI(pat) : start(pat)),
      }, [
        el('span.pat-ic', { text: pat.icon }),
        el('div', {}, [
          el('h4', { text: pat.name }),
          el('p', { text: pat.desc }),
        ]),
        pat.ai ? el('span.pat-badge' + (locked ? '.off' : ''), { text: locked ? 'AI 🔒' : 'AI' }) : el('span.pat-badge.free', { text: 'FREE' }),
      ]));
    }
    root.appendChild(el('div.game-wrap', {}, [
      el('p.game-counter', { text: aiAvailable() ? 'AI mode on ✨ — pick a pattern to practise' : 'Pick a pattern · higher-order ones unlock with a free AI key' }),
      grid,
    ]));
  }

  function promptAI(pat) {
    toast('Apply / Analyze / Create need AI mode', 'bad');
    if (ctx.openAISettings) ctx.openAISettings();
  }

  async function start(pat) {
    let questions;
    if (pat.ai) {
      loading(pat);
      try {
        const raw = await generateQuestions({ notes: ctx.rawNotes, cards, pattern: pat.id, difficulty, count: 6 });
        questions = raw.map((q) => normAI(q));
        if (!questions.length) throw new Error('empty');
      } catch (e) {
        toast(aiErrorMessage(e), 'bad');
        chooser();
        return;
      }
    } else {
      const kinds = pat.id === 'recall' ? ['term', 'def'] : ['def', 'cloze', 'truefalse', 'oddterm'];
      questions = shuffle(buildQuestions(cards, { difficulty, limit: 8 }))
        .map((q) => normOffline(q))
        .slice(0, 8);
      if (!questions.length) { toast('Not enough notes for this pattern', 'bad'); chooser(); return; }
    }
    run(pat, questions);
  }

  function normAI(q) {
    const opts = q.kind === 'mcq'
      ? shuffle(q.options.map((t) => ({ text: t, correct: normalise(t) === normalise(q.answer) })))
      : [];
    const hasCorrect = opts.some((o) => o.correct);
    return { kind: hasCorrect || q.kind === 'short' ? q.kind : 'short', prompt: q.prompt, promptLabel: q.promptLabel, options: opts, answer: q.answer, explanation: q.explanation, ai: true, answerTerm: null };
  }
  function normOffline(q) {
    return { kind: 'mcq', prompt: q.prompt, promptLabel: q.promptLabel, options: q.options, answer: q.answer, explanation: '', ai: false, answerTerm: q.answerTerm };
  }
  function normalise(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  function loading(pat) {
    clear(root);
    root.appendChild(el('div.game-wrap', {}, [
      el('div.pat-loading', {}, [
        el('div.pat-spin'),
        el('p', { text: `Writing ${pat.name.toLowerCase()} questions from your notes…` }),
        el('p.pat-loading-sub', { text: 'AI mode · using your Gemini free tier' }),
      ]),
    ]));
  }

  function run(pat, questions) {
    let i = 0, score = 0, answered = false;

    function finish() {
      clear(root);
      if (score >= Math.ceil(questions.length * 0.7)) { sound.play('win'); confetti(); }
      root.appendChild(resultPanel({
        score, total: questions.length,
        message: `${pat.icon} ${pat.name} practice complete`,
        onReplay: () => start(pat),
        onExit: chooser,
      }));
      ctx.onComplete(score, questions.length);
    }

    function advanceBtn() {
      const label = i + 1 >= questions.length ? 'See results →' : 'Next →';
      root.querySelector('.rq-foot').appendChild(el('button.btn.btn-primary', {
        text: label, onclick: () => { i++; if (i >= questions.length) finish(); else render(); },
      }));
    }
    function reveal(correct, q, extra) {
      if (correct) score++;
      if (q.answerTerm && ctx.onCard) ctx.onCard(q.answerTerm, correct);
      meme.pop(correct);
      const fb = root.querySelector('.pat-fb');
      fb.className = 'pat-fb show ' + (correct ? 'good' : 'bad');
      fb.innerHTML = (correct ? '✓ Correct' : '✗ Not quite') +
        (extra ? ` — ${extra}` : '') +
        (q.explanation ? `<span class="pat-exp">${q.explanation}</span>` : '');
      advanceBtn();
    }

    function chooseMcq(btn, opt, q) {
      if (answered) return;
      answered = true;
      [...root.querySelectorAll('.q-opt')].forEach((b) => { b.disabled = true; if (b.__correct) b.classList.add('correct'); });
      if (!opt.correct) btn.classList.add('wrong');
      sound.play(opt.correct ? 'correct' : 'wrong');
      reveal(!!opt.correct, q);
    }

    async function checkShort(input, q, checkBtn) {
      if (answered) return;
      const val = input.value.trim();
      if (!val) { input.focus(); return; }
      answered = true;
      input.disabled = true; checkBtn.disabled = true;
      let correct, extra = '';
      if (q.ai && aiAvailable()) {
        checkBtn.textContent = 'Grading…';
        try {
          const g = await gradeAnswer({ question: q.prompt, expected: q.answer, userAnswer: val });
          correct = !!g.correct; extra = g.feedback || '';
        } catch (e) { correct = looseMatch(val, q.answer); extra = 'Model answer: ' + q.answer; }
      } else {
        correct = looseMatch(val, q.answer); extra = correct ? '' : 'Model answer: ' + q.answer;
      }
      input.classList.add(correct ? 'correct' : 'wrong');
      sound.play(correct ? 'correct' : 'wrong');
      checkBtn.remove();
      reveal(correct, q, extra);
    }

    function render() {
      answered = false;
      const q = questions[i];
      clear(root);
      const body = [
        el('div.game-progress', {}, [el('div.game-progress-bar', { style: `width:${(i / questions.length) * 100}%` })]),
        el('p.game-counter', { text: `${pat.icon} ${pat.name} · Question ${i + 1} of ${questions.length} · Score ${score}` }),
        el('div.q-card', {}, [el('span.q-label', { text: q.promptLabel }), el('div.q-prompt', { text: q.prompt })]),
      ];
      if (q.kind === 'mcq' && q.options.length) {
        body.push(el('div.q-options', {}, q.options.map((opt) => {
          const b = el('button.q-opt', { onclick: (e) => chooseMcq(e.currentTarget, opt, q), text: opt.text });
          b.__correct = opt.correct;
          return b;
        })));
      } else {
        const input = el('textarea.pat-input', { rows: '3', placeholder: 'Type your answer…' });
        const checkBtn = el('button.btn.btn-primary', { text: 'Check', onclick: () => checkShort(input, q, checkBtn) });
        body.push(input, checkBtn);
      }
      body.push(el('div.pat-fb'), el('div.rq-foot'));
      root.appendChild(el('div.game-wrap', {}, body));
    }
    render();
  }

  chooser();
}
