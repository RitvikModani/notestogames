// app.js — the controller: routing between views, importing notes, launching games.
import * as store from './storage.js';
import { parseNotes, guessSubject } from './parser.js';
import { summarize } from './summarize.js';
import { el, clear, toast, confetti } from './ui.js';
import { sound } from './sound.js';
import { meme } from './memes.js';

import { extractFile, ACCEPTED } from './extract.js';
import * as blaster from './games/blaster.js';
import * as snake from './games/snake.js';
import * as timeattack from './games/timeattack.js';
import * as climb from './games/climb.js';
import * as factorfake from './games/factorfake.js';
import * as wordsearch from './games/wordsearch.js';
import * as match from './games/match.js';
import * as scramble from './games/scramble.js';
import * as hangman from './games/hangman.js';
import * as fcStudy from './study/flashcards.js';
import * as quizStudy from './study/quiz.js';
import * as patternsStudy from './study/patterns.js';
import * as ai from './ai.js';

const GAMES = [blaster, snake, timeattack, climb, factorfake, wordsearch, match, scramble, hangman];
const STUDY = [patternsStudy, fcStudy, quizStudy];
const PLAYABLE = GAMES.concat(STUDY);
const app = document.getElementById('app');

// Some games (e.g. the arcade shooter) run animation loops / global listeners.
// They return a cleanup fn we must call before navigating away.
let activeCleanup = null;
function runCleanup() {
  if (activeCleanup) {
    try { activeCleanup(); } catch (e) { /* ignore */ }
    activeCleanup = null;
  }
}

// ---------- Level / XP ----------
// Gentle curve: each level needs a bit more than the last.
function levelInfo(points) {
  let level = 1;
  let need = 100;
  let acc = 0;
  while (points >= acc + need) {
    acc += need;
    level++;
    need = Math.round(need * 1.35);
  }
  return { level, into: points - acc, need, pct: Math.min(100, Math.round(((points - acc) / need) * 100)) };
}

// ---------- Points HUD ----------
function renderHUD() {
  const stats = store.getStats();
  const lv = levelInfo(stats.points);
  const hud = document.getElementById('hud');
  clear(hud);
  hud.appendChild(
    el('span.hud-item.hud-level', { title: `${lv.into}/${lv.need} XP to level ${lv.level + 1}` }, [
      el('b', { text: 'Lv ' + lv.level }),
      el('span.hud-xp', {}, [el('span.hud-xp-bar', { style: `width:${lv.pct}%` })]),
    ])
  );
  hud.appendChild(el('span.hud-item', { html: `⭐ <b>${stats.points}</b>` }));
  hud.appendChild(el('span.hud-item.hud-streak', { html: `🔥 <b>${stats.streak}</b>` }));
}

function awardPoints(score, total) {
  if (!total) return;
  const before = levelInfo(store.getStats().points).level;
  const gained = Math.max(0, Math.round((score / total) * 20) + score);
  store.addPoints(gained);
  const after = levelInfo(store.getStats().points).level;
  renderHUD();
  if (after > before) {
    setTimeout(() => {
      toast(`⬆ Level ${after}! Nice.`, 'good');
      sound.play('win');
      confetti(1000);
    }, 400);
  } else if (gained > 0) {
    toast(`+${gained} points!`, 'good');
  }
}

// ---------- Home ----------
function viewHome() {
  runCleanup();
  clear(app);
  const decks = store.getDecks();

  const heroArt = `
<svg viewBox="0 0 340 300" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#1a1710" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <!-- note card -->
    <g transform="rotate(-7 95 140)">
      <rect x="26" y="52" width="150" height="176" rx="14" fill="#fffdf8"/>
      <path d="M150 52 L176 52 L176 78 Z" fill="#ffc21e"/>
      <line x1="48" y1="96" x2="150" y2="96" stroke="#ff5247"/>
      <line x1="48" y1="124" x2="150" y2="124" stroke="#2b4cf0"/>
      <line x1="48" y1="152" x2="134" y2="152"/>
      <line x1="48" y1="180" x2="150" y2="180" stroke="#12b76a"/>
    </g>
    <!-- arrow -->
    <path d="M182 150 q22 -14 44 0" fill="none"/>
    <path d="M220 136 l10 10 -12 8" fill="none"/>
    <!-- joystick -->
    <ellipse cx="276" cy="222" rx="46" ry="20" fill="#ffc21e"/>
    <line x1="276" y1="206" x2="276" y2="168"/>
    <circle cx="276" cy="154" r="18" fill="#ff5247"/>
    <circle cx="246" cy="214" r="8" fill="#2b4cf0"/>
    <circle cx="300" cy="212" r="8" fill="#12b76a"/>
    <!-- sparkle + dots -->
    <path d="M196 78 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" fill="#2b4cf0" stroke-width="2"/>
  </g>
  <g fill="#1a1710"><circle cx="300" cy="96" r="3"/><circle cx="314" cy="112" r="3"/><circle cx="34" cy="250" r="3"/><circle cx="52" cy="262" r="3"/></g>
</svg>`;

  const hero = el('section.hero', {}, [
    el('div.hero-copy', {}, [
      el('div.hero-badge', { text: '⚡ 100% free · works offline · your notes stay on your device' }),
      el('h1.hero-title', { html: 'Turn your notes into<br><span class="grad">games you’ll actually play</span>' }),
      el('p.hero-sub', {
        text: 'Drop in a PDF, Word or PowerPoint — or paste your notes — and get an instant summary, smart flashcards, quizzes and 9 arcade games, with difficulty levels and mastery tracking. No sign-up. Nothing leaves your device.',
      }),
      el('div.hero-cta', {}, [
        el('button.btn.btn-primary.btn-lg', { onclick: viewImport, text: '➕ Add your notes' }),
      ]),
    ]),
    el('div.hero-art', { html: heroArt }),
  ]);

  const gamesStrip = el('div.games-strip', {}, GAMES.map((g) =>
    el('div.game-chip', { 'data-accent': g.meta.accent || 'blue' }, [
      el('span.game-chip-icon', { text: g.meta.icon }),
      el('span', { text: g.meta.name }),
    ])
  ));

  const list = el('section.deck-list');
  if (decks.length === 0) {
    list.appendChild(
      el('div.empty-state', {}, [
        el('div.empty-emoji', { text: '📚' }),
        el('h3', { text: 'No study sets yet' }),
        el('p', { text: 'Add your first set of notes to start playing.' }),
      ])
    );
  } else {
    list.appendChild(el('h2.section-title', { text: 'Your study sets' }));
    const grid = el('div.deck-grid');
    for (const deck of decks) {
      grid.appendChild(
        el('article.deck-card', { onclick: () => viewDeck(deck.id) }, [
          el('div.deck-card-top', {}, [
            el('span.deck-subject', { text: deck.subject }),
            el('button.deck-del', {
              title: 'Delete',
              onclick: (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${deck.title}"?`)) {
                  store.deleteDeck(deck.id);
                  viewHome();
                }
              },
              text: '🗑',
            }),
          ]),
          el('h3.deck-title', { text: deck.title }),
          el('p.deck-meta', { text: `${deck.cards.length} study points` }),
          el('div.deck-play', { text: 'Play ▸' }),
        ])
      );
    }
    list.appendChild(grid);
  }

  app.appendChild(el('div.container', {}, [hero, gamesStrip, list]));
}

// ---------- Import ----------
const SAMPLE = `Photosynthesis: the process plants use to turn sunlight, water and CO2 into glucose and oxygen.
Mitochondria: the organelle that produces energy (ATP) for the cell.
Osmosis: the movement of water across a semi-permeable membrane from low to high solute concentration.
Q: What pigment makes leaves green?
A: Chlorophyll
Newton's First Law states that an object stays at rest or in motion unless acted on by a force.
The powerhouse of the cell is the mitochondria.`;

function viewImport() {
  runCleanup();
  clear(app);
  const titleInput = el('input.field', { type: 'text', placeholder: 'Set title (e.g. Biology Ch. 3)' });
  const notesArea = el('textarea.field.notes-area', {
    placeholder:
      'Paste your notes here…\n\nWorks great with:\n• Term: definition\n• Term - definition\n• Q: question / A: answer\n• or plain paragraphs of notes',
    rows: '12',
  });
  const preview = el('div.preview');

  function refreshPreview() {
    const { cards, warnings } = parseNotes(notesArea.value);
    clear(preview);
    if (!notesArea.value.trim()) return;
    if (warnings.length) preview.appendChild(el('div.warn', { text: warnings[0] }));
    preview.appendChild(
      el('p.preview-count', { html: `Found <b>${cards.length}</b> study point${cards.length === 1 ? '' : 's'}` })
    );
    const ul = el('ul.preview-list');
    cards.slice(0, 6).forEach((c) =>
      ul.appendChild(el('li', {}, [el('b', { text: c.term }), document.createTextNode(' — ' + c.definition)]))
    );
    preview.appendChild(ul);
    if (cards.length > 6) preview.appendChild(el('p.preview-more', { text: `+ ${cards.length - 6} more…` }));
  }

  notesArea.addEventListener('input', debounce(refreshPreview, 250));

  // ---- File upload (PDF / Word / PowerPoint / text / photo) ----
  const fileInput = el('input', { type: 'file', accept: ACCEPTED, multiple: true, style: 'display:none' });
  const cameraInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });
  const dropStatus = el('span.drop-status');
  const dropzone = el('label.dropzone', {}, [
    el('span.drop-icon', { text: '📄' }),
    el('span.drop-main', { html: '<b>Upload a file or photo</b> — PDF, Word, PowerPoint, an image of notes, or text' }),
    dropStatus,
    fileInput,
  ]);
  const photoBtn = el('button.btn.btn-ghost.photo-btn', { type: 'button', onclick: () => cameraInput.click(), text: '📷 Take a photo of notes' });
  cameraInput.addEventListener('change', (e) => handleFiles(e.target.files));

  async function handleFiles(files) {
    if (!files || !files.length) return;
    dropzone.classList.add('busy');
    for (const file of files) {
      const isImg = /^image\//.test(file.type) || /\.(png|jpe?g|webp|bmp|heic|gif)$/i.test(file.name);
      dropStatus.textContent = isImg ? `Reading photo…` : `Reading ${file.name}…`;
      try {
        const onProgress = isImg ? (p) => { dropStatus.textContent = `Reading photo… ${Math.round(p * 100)}%`; } : null;
        const { text, kind } = await extractFile(file, onProgress);
        const clean = (text || '').trim();
        if (!clean || clean.length < 20) {
          dropStatus.textContent = '';
          toast(`Couldn't find readable text in ${file.name}.`, 'bad');
          continue;
        }
        notesArea.value = (notesArea.value.trim() ? notesArea.value.trim() + '\n\n' : '') + clean;
        if (!titleInput.value.trim()) titleInput.value = file.name.replace(/\.[^.]+$/, '');
        dropStatus.textContent = `✓ Added ${kind} · ${clean.length.toLocaleString()} characters`;
        sound.play('correct');
      } catch (err) {
        dropStatus.textContent = '';
        toast(err.message || 'Could not read that file', 'bad');
      }
    }
    dropzone.classList.remove('busy');
    refreshPreview();
  }

  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
  ['dragover', 'dragenter'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('over'); })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('over'); })
  );
  dropzone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

  function create() {
    const { cards, warnings } = parseNotes(notesArea.value);
    if (cards.length === 0) {
      toast(warnings[0] || 'Add some notes first', 'bad');
      return;
    }
    const subject = guessSubject(notesArea.value);
    const title = titleInput.value.trim() || `${subject} set`;
    const deck = store.createDeck({ title, subject, cards, rawNotes: notesArea.value });
    confetti(900);
    toast('Study set created!', 'good');
    viewDeck(deck.id);
  }

  app.appendChild(
    el('div.container', {}, [
      backBar('New study set', viewHome),
      el('div.import-grid', {}, [
        el('div.import-left', {}, [
          titleInput,
          dropzone,
          el('div.photo-row', {}, [photoBtn, el('span.photo-hint', { text: 'reads printed or neatly-written notes' })]),
          el('div.or-divider', {}, [el('span', { text: 'or paste / type below' })]),
          notesArea,
          el('div.import-actions', {}, [
            el('button.btn.btn-ghost', {
              onclick: () => {
                notesArea.value = SAMPLE;
                refreshPreview();
              },
              text: 'Try a sample',
            }),
            el('button.btn.btn-primary', { onclick: create, text: '✨ Create games' }),
          ]),
        ]),
        el('div.import-right', {}, [el('h3.preview-title', { text: 'Preview' }), preview]),
      ]),
    ])
  );
}

// ---------- Deck (game menu) ----------
function viewDeck(deckId) {
  runCleanup();
  const deck = store.getDeck(deckId);
  if (!deck) return viewHome();
  clear(app);

  const grid = el('div.gamemenu-grid');
  for (const g of GAMES) {
    const playable = deck.cards.length >= g.meta.min;
    const best = deck.bestScores[g.meta.id];
    grid.appendChild(
      el('article.gamemenu-card' + (playable ? '' : '.disabled'), {
        'data-accent': g.meta.accent || 'blue',
        onclick: () => (playable ? viewGame(deckId, g.meta.id) : toast(`Needs at least ${g.meta.min} study points`, 'bad')),
      }, [
        el('div.gm-icon', { text: g.meta.icon }),
        el('div.gm-body', {}, [
          el('h3', { text: g.meta.name }),
          el('p', { text: g.meta.tagline }),
          best != null ? el('span.gm-best', { text: `Best: ${best}` }) : null,
        ]),
        el('div.gm-go', { text: playable ? '▸' : '🔒' }),
      ])
    );
  }

  const mastery = store.deckMastery(deck);
  const settings = store.getSettings(deck);

  function diffControl() {
    const seg = el('div.seg');
    ['easy', 'medium', 'hard'].forEach((d) => {
      seg.appendChild(el('button.seg-btn' + (settings.difficulty === d ? '.on' : ''), {
        text: d[0].toUpperCase() + d.slice(1),
        onclick: () => { store.updateSettings(deckId, { difficulty: d }); viewDeck(deckId); },
      }));
    });
    return seg;
  }

  app.appendChild(
    el('div.container', {}, [
      backBar(deck.title, viewHome),

      el('div.deck-panel', {}, [
        el('div.deck-panel-top', {}, [
          el('div', {}, [
            el('span.deck-subject.lg', { text: deck.subject }),
            el('span.deck-meta', { text: `  ${deck.cards.length} study points` }),
          ]),
          el('div.deck-diff', {}, [el('span.deck-diff-label', { text: 'Difficulty' }), diffControl()]),
        ]),
        el('div.mastery', {}, [
          el('div.mastery-bar-wrap', {}, [
            el('div.mastery-head', {}, [
              el('span', { html: `<b>${mastery.pct}%</b> mastered` }),
              el('span.mastery-legend', { html: `<i class="dot ok"></i>${mastery.mastered} strong &nbsp; <i class="dot warn"></i>${mastery.review} to review &nbsp; <i class="dot new"></i>${mastery.fresh} new` }),
            ]),
            el('div.mastery-bar', {}, [el('div.mastery-fill', { style: `width:${mastery.pct}%` })]),
          ]),
          mastery.review + mastery.fresh > 0
            ? el('button.btn.btn-primary.mastery-cta', { onclick: () => viewGame(deckId, 'flashcards', { focusWeak: true }), text: '🎯 Review weak cards' })
            : el('span.mastery-done', { text: '✓ All caught up!' }),
        ]),
      ]),

      el('h2.section-title', { text: 'Study' }),
      el('div.study-bento', {}, [
        el('article.study-card.study-summary', { onclick: () => viewSummary(deckId) }, [
          el('div.study-ic', { text: '📝' }),
          el('div', {}, [
            el('h3', { text: 'Smart Summary' }),
            el('p', { text: 'An instant TL;DR, the key points, and every key term — pulled from your notes.' }),
          ]),
          el('div.study-feat', {}, [
            el('span', { text: '⚡ TL;DR' }),
            el('span', { text: '🔑 Key points' }),
            el('span', { text: '🏷️ Key terms' }),
          ]),
          el('span.study-go', { text: 'Open summary →' }),
        ]),
        ...STUDY.map((g) => {
          const playable = deck.cards.length >= g.meta.min;
          const best = deck.bestScores[g.meta.id];
          return el('article.study-card' + (playable ? '' : '.disabled'), {
            'data-accent': g.meta.accent,
            onclick: () => (playable ? viewGame(deckId, g.meta.id) : toast(`Needs at least ${g.meta.min} study points`, 'bad')),
          }, [
            el('div.study-ic', { text: g.meta.icon }),
            el('div', {}, [el('h3', { text: g.meta.name }), el('p', { text: g.meta.tagline })]),
            best != null ? el('span.gm-best', { text: `Best: ${best}` }) : el('span.study-go', { text: playable ? 'Start →' : '🔒' }),
          ]);
        }),
      ]),

      el('h2.section-title.section-play', { text: 'Play' }),
      el('p.section-sub', { text: `Nine arcade games · ${settings.difficulty} mode. Every round you play updates your mastery.` }),
      grid,
    ])
  );
}

// ---------- Summary ----------
function viewSummary(deckId) {
  runCleanup();
  const deck = store.getDeck(deckId);
  if (!deck) return viewHome();
  clear(app);
  const settings = store.getSettings(deck);
  const sum = summarize(
    deck.rawNotes || deck.cards.map((c) => `${c.term}: ${c.definition}`).join('. '),
    deck.cards,
    { length: settings.summaryLength }
  );

  const copyText = `TL;DR: ${sum.tldr}\n\nKey points:\n` + sum.keyPoints.map((p) => '• ' + p).join('\n') +
    `\n\nKey terms: ${sum.keyTerms.join(', ')}`;

  const lenControl = el('div.seg.sum-len');
  [['short', 'Short'], ['medium', 'Medium'], ['detailed', 'Detailed']].forEach(([v, label]) => {
    lenControl.appendChild(el('button.seg-btn' + (settings.summaryLength === v ? '.on' : ''), {
      text: label,
      onclick: () => { store.updateSettings(deckId, { summaryLength: v }); viewSummary(deckId); },
    }));
  });

  app.appendChild(el('div.container', {}, [
    backBar(`📝 ${deck.title} — Summary`, () => viewDeck(deckId)),
    el('div.sum-wrap', {}, [
      el('div.sum-lenrow', {}, [el('span.sum-len-label', { text: 'Length' }), lenControl]),
      el('div.sum-stats', {}, [
        el('div.sum-stat', {}, [el('b', { text: sum.stats.points }), el('span', { text: 'study points' })]),
        el('div.sum-stat', {}, [el('b', { text: sum.stats.words.toLocaleString() }), el('span', { text: 'words' })]),
        el('div.sum-stat', {}, [el('b', { text: '~' + sum.stats.readingMin + 'm' }), el('span', { text: 'read' })]),
      ]),
      el('div.sum-tldr', {}, [el('span.sum-tldr-label', { text: 'TL;DR' }), el('p', { text: sum.tldr })]),
      el('div.sum-grid', {}, [
        el('div.sum-points', {}, [
          el('h3.sum-h', { text: `🔑 Key points (${sum.keyPoints.length})` }),
          el('ul.sum-list', {}, sum.keyPoints.map((p) => el('li', { text: p }))),
        ]),
        el('div.sum-terms', {}, [
          el('h3.sum-h', { text: '🏷️ Key terms' }),
          el('div.sum-chips', {}, sum.keyTerms.map((t) => el('span.sum-chip', { text: t }))),
          el('div.sum-actions', {}, [
            el('button.btn.btn-primary', { onclick: () => viewGame(deckId, 'flashcards'), text: '🗂️ Review as flashcards' }),
            el('button.btn.btn-ghost', {
              onclick: (e) => { navigator.clipboard && navigator.clipboard.writeText(copyText); toast('Summary copied', 'good'); },
              text: '⧉ Copy summary',
            }),
          ]),
        ]),
      ]),
    ]),
  ]));
}

// ---------- Active game ----------
function viewGame(deckId, gameId, opts = {}) {
  runCleanup();
  const deck = store.getDeck(deckId);
  const game = PLAYABLE.find((g) => g.meta.id === gameId);
  if (!deck || !game) return viewDeck(deckId);
  clear(app);
  const settings = store.getSettings(deck);

  const stage = el('div.game-stage');
  app.appendChild(
    el('div.container', {}, [
      backBar(`${game.meta.icon} ${game.meta.name}`, () => viewDeck(deckId)),
      stage,
    ])
  );

  activeCleanup = game.mount(stage, deck.cards, {
    difficulty: settings.difficulty,
    flashcardCount: settings.flashcardCount,
    focusWeak: !!opts.focusWeak,
    weakOrder: store.cardsByWeakness(deck),
    rawNotes: deck.rawNotes || '',
    openAISettings: () => openAIDialog(),
    onCard: (term, correct) => store.recordCard(deckId, term, correct),
    onComplete: (score, total) => {
      store.recordBestScore(deckId, gameId, score);
      awardPoints(score, total);
    },
    onExit: () => viewDeck(deckId),
  }) || null;
}

// ---------- helpers ----------
function backBar(title, onBack) {
  return el('div.backbar', {}, [
    el('button.back-btn', { onclick: onBack, text: '← Back' }),
    el('h2.backbar-title', { text: title }),
  ]);
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

// ---------- AI mode settings (bring your own free key) ----------
function openAIDialog() {
  const existing = document.getElementById('ai-modal');
  if (existing) existing.remove();
  const keyInput = el('input.field', { type: 'password', placeholder: 'Paste your Gemini API key', value: ai.getKey(), autocomplete: 'off' });
  const status = el('div.ai-status');
  const modal = el('div#ai-modal.modal-backdrop', { onclick: (e) => { if (e.target.id === 'ai-modal') modal.remove(); } }, []);
  function setStatus() {
    const on = ai.aiAvailable();
    status.className = 'ai-status ' + (on ? 'on' : 'off');
    status.textContent = on ? '✨ AI mode is ON' : 'AI mode is off — the free offline engine is in use';
    refreshAIBtn();
  }
  const testBtn = el('button.btn.btn-ghost', {
    text: 'Test key',
    onclick: async (e) => {
      ai.setKey(keyInput.value); setStatus();
      const b = e.currentTarget; b.textContent = 'Testing…'; b.disabled = true;
      try {
        await ai.generateQuestions({ notes: 'Photosynthesis lets plants turn light into glucose.', pattern: 'apply', count: 1 });
        toast('Key works — AI mode ready ✨', 'good');
      } catch (err) { toast(ai.aiErrorMessage(err), 'bad'); }
      b.textContent = 'Test key'; b.disabled = false;
    },
  });
  modal.appendChild(el('div.modal', {}, [
    el('div.modal-head', {}, [el('h3', { text: '✨ AI question mode' }), el('button.modal-x', { onclick: () => modal.remove(), text: '✕' })]),
    el('p.modal-p', { html: 'Generate higher-order <b>Apply · Analyze · Create</b> questions — and AI grading of your written answers — from your own notes. Uses Google Gemini’s <b>free tier</b>: bring your own key. It’s stored only on this device and is sent straight to Google, never to us.' }),
    el('ol.modal-steps', {}, [
      el('li', { html: 'Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> (no card needed).' }),
      el('li', { text: 'Paste it below and Save.' }),
    ]),
    keyInput,
    status,
    el('div.modal-actions', {}, [
      testBtn,
      el('button.btn.btn-ghost', { text: 'Remove', onclick: () => { ai.setKey(''); keyInput.value = ''; setStatus(); toast('AI key removed', 'bad'); } }),
      el('button.btn.btn-primary', { text: 'Save', onclick: () => { ai.setKey(keyInput.value); setStatus(); toast(ai.aiAvailable() ? 'AI mode on ✨' : 'AI mode off', 'good'); } }),
    ]),
    el('p.modal-note', { text: 'Tip: you can restrict the key to your site’s domain in Google AI Studio. AI works on the hosted site; the sandboxed preview may block external AI calls.' }),
  ]));
  document.body.appendChild(modal);
  setStatus();
  setTimeout(() => keyInput.focus(), 40);
}

// ---------- boot ----------
renderHUD();

const brand = document.getElementById('brand');
brand.addEventListener('click', viewHome);
brand.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    viewHome();
  }
});

// Sound toggle
const soundBtn = document.getElementById('sound-toggle');
function refreshSoundBtn() {
  const m = sound.isMuted();
  soundBtn.textContent = m ? '🔇' : '🔊';
  soundBtn.setAttribute('aria-pressed', String(!m));
  soundBtn.classList.toggle('muted', m);
}
soundBtn.addEventListener('click', () => {
  sound.toggle();
  refreshSoundBtn();
});
refreshSoundBtn();

// Meme toggle
const memeBtn = document.getElementById('meme-toggle');
function refreshMemeBtn() {
  const on = meme.isOn();
  memeBtn.textContent = on ? '😂' : '😐';
  memeBtn.setAttribute('aria-pressed', String(on));
  memeBtn.classList.toggle('muted', !on);
}
if (memeBtn) {
  memeBtn.addEventListener('click', () => {
    const on = meme.toggle();
    refreshMemeBtn();
    toast(on ? 'Memes on 😹' : 'Memes off', on ? 'good' : 'bad');
  });
  refreshMemeBtn();
}

// Theme toggle (light / dark). Stored choice overrides OS preference.
const THEME_KEY = 'n2g.theme.v1';
const themeBtn = document.getElementById('theme-toggle');
function currentTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set) return set;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  if (themeBtn) themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
}
(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
  applyTheme(saved || currentTheme());
})();
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
  });
}

// AI mode settings button
const aiBtn = document.getElementById('ai-toggle');
function refreshAIBtn() {
  if (!aiBtn) return;
  aiBtn.classList.toggle('muted', !ai.aiAvailable());
  aiBtn.title = ai.aiAvailable() ? 'AI mode: on' : 'AI mode: off';
}
if (aiBtn) {
  aiBtn.addEventListener('click', openAIDialog);
  refreshAIBtn();
}

// Light click feedback on navigation controls (games handle their own sounds).
document.addEventListener('click', (e) => {
  if (e.target.closest('button.btn, .back-btn, .deck-card, .gamemenu-card:not(.disabled), .game-chip')) {
    sound.play('click');
  }
});

viewHome();
