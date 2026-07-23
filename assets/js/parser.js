// parser.js — turns free-form student notes into structured study "cards".
//
// A card = { term, definition, cloze } where:
//   term       -> the thing to learn (a word/name/concept)
//   definition -> the explanation / answer
//   cloze      -> a sentence with the key idea blanked out (for fill-in-the-blank)
//
// The parser is fully client-side (no AI service, no cost). It recognises the
// note styles students actually use: "Term: definition", "Term - definition",
// Q&A pairs, markdown bold, bulleted glossaries, and plain prose sentences
// containing definitional cues like "X is ...".

const STOP_WORDS = new Set(
  ('a an the and or but of to in on at for with without from by as is are was were be been being ' +
    'that this these those it its it\'s they them their there here which who whom whose what when ' +
    'where why how than then so if not no yes can will would should could may might must do does did ' +
    'has have had into over under about above below between within also very more most some any each ' +
    'such many much few both all one two three because while during after before through per via using')
    .split(' ')
);

const clean = (s) =>
  (s || '')
    .replace(/^[\s]*[-*•·▪◦‣>»]+\s*/, '') // leading bullets
    .replace(/^\s*\d+[.)]\s*/, '') // leading "1." / "2)"
    .replace(/\*\*|__|`/g, '') // markdown emphasis
    .replace(/\s+/g, ' ')
    .trim();

const stripTrailingPunct = (s) => s.replace(/[\s:；;,.，、]+$/, '').trim();

// Split raw text into logical lines, keeping paragraph structure loosely intact.
function toLines(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

// Try to split a line into term + definition using common delimiters.
function splitPair(line) {
  const delimiters = [
    /^(.{1,80}?)\s*[:：]\s+(.+)$/, // Term: definition
    /^(.{1,80}?)\s+[-–—=]\s+(.+)$/, // Term - definition / Term = definition
    /^(.{1,80}?)\t+(.+)$/, // tab separated
  ];
  for (const re of delimiters) {
    const m = line.match(re);
    if (m) {
      const term = stripTrailingPunct(clean(m[1]));
      const def = clean(m[2]);
      // Term should look like a label, not a whole sentence.
      if (term && def && term.split(' ').length <= 8 && def.length >= 2) {
        return { term, definition: def };
      }
    }
  }
  return null;
}

// Detect "X is / are / means / refers to ..." definitional sentences in prose.
function definitionalSentence(sentence) {
  const m = sentence.match(
    /^(.{1,80}?)\s+(?:is|are|was|were|means?|refers to|is defined as|describes?|represents?)\s+(.+)$/i
  );
  if (!m) return null;
  const term = stripTrailingPunct(clean(m[1]));
  if (!term || term.split(' ').length > 6) return null;
  // Avoid pronoun subjects ("It is ...", "They are ...").
  if (STOP_WORDS.has(term.toLowerCase())) return null;
  return { term, definition: clean(sentence) };
}

// Pick the most "learnable" keyword in a sentence to blank out for cloze games.
function pickKeyword(sentence) {
  const words = sentence.match(/[A-Za-z][A-Za-z'-]{2,}/g) || [];
  let best = null;
  let bestScore = -1;
  for (const w of words) {
    const lw = w.toLowerCase();
    if (STOP_WORDS.has(lw)) continue;
    let score = w.length;
    if (/^[A-Z]/.test(w)) score += 4; // proper nouns / capitalised terms
    if (w.length > 7) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = w;
    }
  }
  return best;
}

// A cloze is only useful if some words remain around the blank for context.
function hasContext(text) {
  const rest = text.replace('_____', ' ').replace(/[^A-Za-z0-9]+/g, ' ').trim();
  return rest.split(/\s+/).filter(Boolean).length >= 2;
}

// Build a cloze (fill-in-the-blank) version of a card.
function buildCloze(term, definition) {
  // Prefer blanking the term where it appears inside its own definition.
  if (term && definition) {
    const re = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(definition) && definition.length > term.length + 4) {
      const text = definition.replace(re, '_____');
      if (hasContext(text)) return { text, answer: term };
    }
  }
  // Otherwise blank a salient keyword from the definition.
  const kw = pickKeyword(definition || '');
  if (kw) {
    const re = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    const text = definition.replace(re, '_____');
    if (hasContext(text)) return { text, answer: kw };
  }
  return null;
}

function splitSentences(text) {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

/**
 * Parse raw notes into an array of study cards.
 * @returns {{cards: Array, warnings: string[]}}
 */
export function parseNotes(rawText) {
  const text = (rawText || '').trim();
  const cards = [];
  const seen = new Set();

  const push = (term, definition) => {
    term = stripTrailingPunct(term || '');
    definition = (definition || '').trim();
    if (!term || !definition) return;
    if (term.toLowerCase() === definition.toLowerCase()) return;
    const key = term.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const cloze = buildCloze(term, definition);
    cards.push({ term, definition, cloze });
  };

  const lines = toLines(text);

  // Pass 1: explicit Q&A pairs across two lines.
  for (let i = 0; i < lines.length; i++) {
    const q = lines[i].match(/^(?:q(?:uestion)?)\s*[:.)-]\s*(.+)$/i);
    if (q && i + 1 < lines.length) {
      const a = lines[i + 1].match(/^(?:a(?:nswer)?)\s*[:.)-]\s*(.+)$/i);
      if (a) {
        push(clean(q[1]), clean(a[1]));
        lines[i] = '';
        lines[i + 1] = '';
        i++;
      }
    }
  }

  // Pass 2: delimiter pairs (Term: definition, Term - definition, ...).
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    const pair = splitPair(lines[i]);
    if (pair) {
      push(pair.term, pair.definition);
      lines[i] = '';
    }
  }

  // Pass 3: definitional prose sentences from whatever text is left.
  const remaining = lines.filter(Boolean).join(' ');
  if (remaining) {
    for (const sentence of splitSentences(remaining)) {
      const def = definitionalSentence(sentence);
      if (def) {
        push(def.term, def.definition);
      }
    }
  }

  // Pass 4: if we still have very little, mine prose for cloze-only cards so
  // even messy notes yield something playable.
  if (cards.length < 4) {
    for (const sentence of splitSentences(text)) {
      if (cards.length >= 12) break;
      const kw = pickKeyword(sentence);
      if (!kw || seen.has(kw.toLowerCase())) continue;
      seen.add(kw.toLowerCase());
      const re = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      cards.push({
        term: kw,
        definition: sentence,
        cloze: { text: sentence.replace(re, '_____'), answer: kw },
      });
    }
  }

  const warnings = [];
  if (cards.length === 0) {
    warnings.push(
      'We couldn\'t find clear study points. Try one idea per line, e.g. "Photosynthesis: how plants make food from sunlight".'
    );
  } else if (cards.length < 3) {
    warnings.push(
      'Only found a few study points. Add more lines like "Term: definition" or "Q: ... / A: ..." to unlock every game.'
    );
  }

  return { cards, warnings };
}

// Suggest a subject label by keyword-spotting the notes (nice-to-have flavour).
export function guessSubject(text) {
  const t = (text || '').toLowerCase();
  const map = [
    ['Biology', /cell|photosynth|dna|organism|enzyme|mitochond|species|ecosystem|protein/],
    ['Chemistry', /atom|molecul|reaction|acid|base|ion|electron|compound|periodic/],
    ['Physics', /force|velocity|energy|gravity|newton|quantum|voltage|momentum|wave/],
    ['History', /war|empire|revolution|century|treaty|ancient|dynasty|king|president/],
    ['Geography', /river|mountain|climate|continent|capital|country|population|latitude/],
    ['Mathematics', /equation|theorem|integral|derivative|algebra|geometry|function|matrix/],
    ['Computer Science', /algorithm|function|variable|array|loop|binary|compile|database|code/],
    ['Language', /verb|noun|grammar|tense|vocabulary|translate|pronoun|adjective/],
    ['Economics', /market|demand|supply|inflation|gdp|trade|economy|revenue/],
  ];
  for (const [subject, re] of map) if (re.test(t)) return subject;
  return 'General';
}
