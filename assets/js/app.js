// app.js — the controller: routing between views, importing notes, launching games.
import * as store from './storage.js';
import { parseNotes, guessSubject } from './parser.js';
import { el, clear, toast, confetti } from './ui.js';

import * as blaster from './games/blaster.js';
import * as match from './games/match.js';
import * as scramble from './games/scramble.js';
import * as hangman from './games/hangman.js';

const GAMES = [blaster, match, scramble, hangman];
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

// ---------- Points HUD ----------
function renderHUD() {
  const stats = store.getStats();
  const hud = document.getElementById('hud');
  clear(hud);
  hud.appendChild(el('span.hud-item', { html: `⭐ <b>${stats.points}</b> pts` }));
  hud.appendChild(el('span.hud-item', { html: `🔥 <b>${stats.streak}</b> day streak` }));
}

function awardPoints(score, total) {
  if (!total) return;
  const gained = Math.max(0, Math.round((score / total) * 20) + score);
  store.addPoints(gained);
  renderHUD();
  if (gained > 0) toast(`+${gained} points!`, 'good');
}

// ---------- Home ----------
function viewHome() {
  runCleanup();
  clear(app);
  const decks = store.getDecks();

  const hero = el('section.hero', {}, [
    el('div.hero-badge', { text: '100% free · works offline · your notes stay on your device' }),
    el('h1.hero-title', { html: 'Turn your notes into<br><span class="grad">games you actually enjoy</span>' }),
    el('p.hero-sub', {
      text: 'Paste any notes and instantly play real games built from them — blast the right answer out of the sky, unscramble terms, match, and outguess the clock.',
    }),
    el('button.btn.btn-primary.btn-lg', { onclick: viewImport, text: '➕ Add your notes' }),
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

  app.appendChild(
    el('div.container', {}, [
      backBar(deck.title, viewHome),
      el('div.deck-head', {}, [
        el('span.deck-subject.lg', { text: deck.subject }),
        el('span.deck-meta', { text: `${deck.cards.length} study points` }),
      ]),
      el('h2.section-title', { text: 'Pick a game' }),
      grid,
    ])
  );
}

// ---------- Active game ----------
function viewGame(deckId, gameId) {
  runCleanup();
  const deck = store.getDeck(deckId);
  const game = GAMES.find((g) => g.meta.id === gameId);
  if (!deck || !game) return viewDeck(deckId);
  clear(app);

  const stage = el('div.game-stage');
  app.appendChild(
    el('div.container', {}, [
      backBar(`${game.meta.icon} ${game.meta.name}`, () => viewDeck(deckId)),
      stage,
    ])
  );

  activeCleanup = game.mount(stage, deck.cards, {
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

// ---------- boot ----------
renderHUD();
document.getElementById('brand').addEventListener('click', viewHome);
viewHome();
