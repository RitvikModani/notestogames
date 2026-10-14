// summarize.js — a fast, client-side extractive summariser (no AI service, free).
// Ranks sentences by keyword salience + position and returns a TL;DR, key
// points, and key terms for the Summary study view.

const STOP = new Set(
  ('a an the and or but of to in on at for with without from by as is are was were be been being that ' +
    'this these those it its they them their there here which who whom whose what when where why how than ' +
    'then so if not no yes can will would should could may might must do does did has have had into over ' +
    'under about above below between within also very more most some any each such many much few both all ' +
    'one two three because while during after before through per via using onto upon we you your our')
    .split(' ')
);

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 24 && /[a-z]/.test(s) && s.split(' ').length >= 4);
}

export function summarize(rawText, cards = [], opts = {}) {
  const length = opts.length || 'medium';
  const LEN = { short: { pts: 3, terms: 6 }, medium: { pts: 5, terms: 8 }, detailed: { pts: 9, terms: 14 } }[length] || { pts: 5, terms: 8 };
  const text = (rawText || '').trim();
  const sentences = splitSentences(text);
  const words = (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []);
  const wordCount = (text.match(/\S+/g) || []).length;

  // term frequencies (minus stop words)
  const freq = {};
  for (const w of words) if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  const maxF = Math.max(1, ...Object.values(freq));

  // score sentences
  const scored = sentences.map((s, i) => {
    const sw = (s.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter((w) => !STOP.has(w));
    let score = sw.reduce((a, w) => a + (freq[w] || 0) / maxF, 0) / Math.sqrt(sw.length || 1);
    if (i < 3) score *= 1.15; // early sentences often set context
    if (/\b(is|are|means|defined|refers|therefore|thus|because|important|key|main)\b/i.test(s)) score *= 1.08;
    return { s, i, score };
  });

  const take = Math.min(LEN.pts, Math.max(2, Math.min(sentences.length, LEN.pts)));
  const keyPoints = scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, take)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);

  const tldr = scored.slice().sort((a, b) => b.score - a.score)[0]?.s || (cards[0] ? `${cards[0].term}: ${cards[0].definition}` : '');

  // key terms: prefer parsed card terms, else most frequent content words
  let keyTerms = cards.map((c) => c.term).filter(Boolean).slice(0, LEN.terms);
  if (keyTerms.length < Math.min(5, LEN.terms)) {
    keyTerms = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, LEN.terms)
      .map(([w]) => w);
  }

  return {
    tldr: tldr.length > 200 ? tldr.slice(0, 197).trim() + '…' : tldr,
    keyPoints,
    keyTerms,
    stats: {
      words: wordCount,
      readingMin: Math.max(1, Math.round(wordCount / 200)),
      points: cards.length,
      sentences: sentences.length,
    },
  };
}
