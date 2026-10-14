// storage.js — tiny localStorage-backed data layer for decks & progress.
// Everything lives in the browser, so the whole app is 100% free to host and run.

const DECKS_KEY = 'n2g.decks.v1';
const STATS_KEY = 'n2g.stats.v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn('storage read failed', e);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('storage write failed', e);
  }
}

export function getDecks() {
  return read(DECKS_KEY, []);
}

export function getDeck(id) {
  return getDecks().find((d) => d.id === id) || null;
}

export function saveDeck(deck) {
  const decks = getDecks();
  const idx = decks.findIndex((d) => d.id === deck.id);
  if (idx >= 0) decks[idx] = deck;
  else decks.unshift(deck);
  write(DECKS_KEY, decks);
  return deck;
}

export function deleteDeck(id) {
  write(DECKS_KEY, getDecks().filter((d) => d.id !== id));
}

export function createDeck({ title, subject, cards, rawNotes }) {
  const deck = {
    id: 'deck_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: title || 'Untitled deck',
    subject: subject || 'General',
    cards: cards || [],
    rawNotes: rawNotes || '',
    createdAt: Date.now(),
    bestScores: {}, // { gameId: score }
    settings: { difficulty: 'medium', summaryLength: 'medium', flashcardCount: 0 }, // 0 = all
    cardStats: {}, // { termLower: { box, seen, correct, last } } — Leitner mastery
  };
  return saveDeck(deck);
}

// ---- Settings (difficulty, summary length, flashcard count) ----
const DEFAULT_SETTINGS = { difficulty: 'medium', summaryLength: 'medium', flashcardCount: 0 };
export function getSettings(deck) {
  return Object.assign({}, DEFAULT_SETTINGS, deck && deck.settings);
}
export function updateSettings(deckId, patch) {
  const deck = getDeck(deckId);
  if (!deck) return;
  deck.settings = Object.assign({}, DEFAULT_SETTINGS, deck.settings, patch);
  saveDeck(deck);
  return deck.settings;
}

// ---- Spaced-repetition mastery (Leitner boxes 0..5) ----
// This is what makes the app facilitate deep learning rather than be a showpiece:
// every answer, in any mode, moves a card up (got it) or down (missed it), and the
// study tools resurface weak cards first.
const MAX_BOX = 5;
export function recordCard(deckId, term, correct) {
  if (!term) return;
  const deck = getDeck(deckId);
  if (!deck) return;
  deck.cardStats = deck.cardStats || {};
  const key = String(term).toLowerCase();
  const s = deck.cardStats[key] || { box: 0, seen: 0, correct: 0, last: 0 };
  s.seen += 1;
  if (correct) { s.correct += 1; s.box = Math.min(MAX_BOX, s.box + 1); }
  else { s.box = Math.max(0, s.box - 1); }
  s.last = Date.now();
  deck.cardStats[key] = s;
  saveDeck(deck);
}

export function cardBox(deck, term) {
  const s = deck.cardStats && deck.cardStats[String(term).toLowerCase()];
  return s ? s.box : 0;
}

// Mastery snapshot for the deck dashboard.
export function deckMastery(deck) {
  const cards = deck.cards || [];
  let mastered = 0, review = 0, fresh = 0, boxSum = 0;
  for (const c of cards) {
    const s = deck.cardStats && deck.cardStats[c.term.toLowerCase()];
    const box = s ? s.box : 0;
    boxSum += box;
    if (!s || s.seen === 0) fresh++;
    else if (box >= 4) mastered++;
    else if (box <= 1) review++;
  }
  return {
    mastered, review, fresh,
    total: cards.length,
    pct: cards.length ? Math.round((boxSum / (cards.length * MAX_BOX)) * 100) : 0,
  };
}

// Cards ordered weakest-first (for "Review weak" / spaced repetition).
export function cardsByWeakness(deck) {
  const cards = (deck.cards || []).slice();
  return cards.sort((a, b) => {
    const sa = deck.cardStats && deck.cardStats[a.term.toLowerCase()];
    const sb = deck.cardStats && deck.cardStats[b.term.toLowerCase()];
    const ba = sa ? sa.box : 0, bb = sb ? sb.box : 0;
    if (ba !== bb) return ba - bb;              // lower box first
    const na = sa ? sa.seen : 0, nb = sb ? sb.seen : 0;
    return na - nb;                              // then least-seen first
  });
}

export function recordBestScore(deckId, gameId, score) {
  const deck = getDeck(deckId);
  if (!deck) return;
  const prev = deck.bestScores[gameId] || 0;
  if (score > prev) {
    deck.bestScores[gameId] = score;
    saveDeck(deck);
  }
}

// ---- Global stats (points + streak) ----
export function getStats() {
  return read(STATS_KEY, { points: 0, gamesPlayed: 0, streak: 0, lastPlayed: null });
}

export function addPoints(points) {
  const stats = getStats();
  stats.points += points;
  stats.gamesPlayed += 1;

  const today = new Date().toDateString();
  const last = stats.lastPlayed;
  if (last !== today) {
    const yesterday = new Date(Date.now() - 864e5).toDateString();
    stats.streak = last === yesterday ? stats.streak + 1 : 1;
    stats.lastPlayed = today;
  }
  write(STATS_KEY, stats);
  return stats;
}
