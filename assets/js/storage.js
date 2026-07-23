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
  };
  return saveDeck(deck);
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
