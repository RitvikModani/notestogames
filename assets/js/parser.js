// parser.js — turns free-form notes (or extracted document text) into structured
// study cards. Rewritten for accuracy on real, higher-level study material.
//
// A card = { term, definition, cloze }
//   term       -> the concept to learn (kept concise: a word / name / short phrase)
//   definition -> the explanation / answer (may be a full, technical sentence)
//   cloze      -> a sentence with the key idea blanked out (for fill-in games)
//
// Fully client-side: no AI service, no API keys, no cost.

const STOP_WORDS = new Set(
  ('a an the and or but of to in on at for with without from by as is are was were be been being ' +
    'that this these those it its they them their there here which who whom whose what when where why ' +
    'how than then so if not no yes can will would should could may might must do does did has have had ' +
    'into over under about above below between within also very more most some any each such many much ' +
    'few both all one two three because while during after before through per via using into onto upon ' +
    'i.e e.g etc et al')
    .split(' ')
);

const clean = (s) =>
  (s || '')
    .replace(/^[\s]*[-*•·▪◦‣>»–—]+\s*/, '') // leading bullets / dashes
    .replace(/^\s*\(?\d+[.)]\s*/, '') // "1." "2)" "(3)"
    .replace(/^\s*[a-z][.)]\s+/i, '') // "a) " "b. "
    .replace(/\*\*|__|`|#/g, '') // markdown emphasis / heading marks
    .replace(/\s+/g, ' ')
    .trim();

const stripEdge = (s) => (s || '').replace(/^[\s"'“”(]+|[\s"'”:；;,.，、)]+$/g, '').trim();
const wordCount = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const isJunkLine = (s) =>
  !s ||
  /^(chapter|unit|section|lecture|page|slide|figure|table|fig\.?|©|copyright)\b/i.test(s) ||
  /^\d+$/.test(s) || // lone page numbers
  /^[-=_*·•\s]+$/.test(s); // separator rules

function toLines(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

// A concise, label-like term: short, not a whole sentence, not a stop word.
function looksLikeTerm(s) {
  const w = wordCount(s);
  return s && w >= 1 && w <= 6 && !STOP_WORDS.has(s.toLowerCase()) && !/[.!?]$/.test(s);
}

// Split a line into term + definition on the first delimiter, orienting so the
// concise side becomes the term.
function splitPair(line) {
  const delims = [
    { re: /^(.{1,90}?)\s*[:：]\s+(.+)$/ },
    { re: /^(.{1,90}?)\s+[-–—=]\s+(.+)$/ },
    { re: /^(.{1,90}?)\t+(.+)$/ },
  ];
  for (const { re } of delims) {
    const m = line.match(re);
    if (!m) continue;
    let left = stripEdge(clean(m[1]));
    let right = clean(m[2]);
    if (!left || !right || right.length < 2) continue;
    // If the left side is a long phrase but the right side is a tidy term,
    // the note is written "description: Term" — flip it.
    if (!looksLikeTerm(left) && looksLikeTerm(right) && wordCount(left) > wordCount(right) + 1) {
      [left, right] = [right, left];
    }
    if (wordCount(left) <= 8) return { term: left, definition: right };
  }
  return null;
}

// "X is/are/means/refers to Y" — pick the concise, learnable side as the term.
function definitionalSentence(sentence) {
  const m = sentence.match(
    /^(.{1,90}?)\s+(?:is|are|was|were|means?|refers? to|is defined as|is called|are called|describes?|denotes?|represents?)\s+(.+)$/i
  );
  if (!m) return null;
  let subject = stripEdge(clean(m[1]));
  let object = clean(m[2]);
  if (!subject || STOP_WORDS.has(subject.toLowerCase())) return null;

  // Pattern "The powerhouse of the cell is the mitochondria" -> term should be
  // the concise proper noun on the right, clue is the whole sentence.
  const objHead = stripEdge(object.replace(/^(a|an|the)\s+/i, '')).split(/[.,;]/)[0];
  if (!looksLikeTerm(subject) && looksLikeTerm(objHead) && wordCount(objHead) <= 3) {
    return { term: objHead, definition: clean(sentence) };
  }
  if (looksLikeTerm(subject)) return { term: subject, definition: clean(sentence) };
  return null;
}

function pickKeyword(sentence) {
  const words = sentence.match(/[A-Za-z][A-Za-z'-]{2,}/g) || [];
  let best = null;
  let bestScore = -1;
  for (const w of words) {
    if (STOP_WORDS.has(w.toLowerCase())) continue;
    let score = w.length;
    if (/^[A-Z]/.test(w)) score += 4;
    if (w.length > 7) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = w;
    }
  }
  return best;
}

function hasContext(text) {
  const rest = text.replace('_____', ' ').replace(/[^A-Za-z0-9]+/g, ' ').trim();
  return rest.split(/\s+/).filter(Boolean).length >= 2;
}

function buildCloze(term, definition) {
  if (term && definition) {
    const re = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(definition) && definition.length > term.length + 4) {
      const text = definition.replace(re, '_____');
      if (hasContext(text)) return { text, answer: term };
    }
  }
  const kw = pickKeyword(definition || '');
  if (kw) {
    const re = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    const text = definition.replace(re, '_____');
    if (hasContext(text)) return { text, answer: kw };
  }
  return null;
}

/**
 * Parse raw notes/document text into study cards.
 * @returns {{cards: Array, warnings: string[]}}
 */
export function parseNotes(rawText) {
  const text = (rawText || '').trim();
  const cards = [];
  const seen = new Set();

  const push = (term, definition) => {
    term = stripEdge(term || '');
    definition = (definition || '').trim();
    if (!term || !definition) return;
    if (term.length > 60) return; // terms should stay concise
    if (term.toLowerCase() === definition.toLowerCase()) return;
    const key = term.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cards.push({ term, definition, cloze: buildCloze(term, definition) });
  };

  let lines = toLines(text).filter((l) => !isJunkLine(l));

  // Pass 1: Q&A pairs — the ANSWER is the concept (term); the QUESTION is the clue.
  for (let i = 0; i < lines.length; i++) {
    const q = lines[i] && lines[i].match(/^(?:q(?:uestion)?)\s*\d*\s*[:.)-]\s*(.+)$/i);
    if (q && i + 1 < lines.length) {
      const a = lines[i + 1].match(/^(?:a(?:ns(?:wer)?)?)\s*\d*\s*[:.)-]\s*(.+)$/i);
      if (a) {
        const answer = clean(a[1]);
        const question = clean(q[1]);
        // term = concise answer; definition = the question (used as the clue)
        if (looksLikeTerm(stripEdge(answer))) push(stripEdge(answer), question);
        else push(pickKeyword(answer) || stripEdge(answer), `${question} — ${answer}`);
        lines[i] = '';
        lines[i + 1] = '';
        i++;
      }
    }
  }

  // Pass 2: delimiter pairs ("Term: definition", "Term - definition", ...).
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    const pair = splitPair(lines[i]);
    if (pair) {
      push(pair.term, pair.definition);
      lines[i] = '';
    }
  }

  // Pass 3: definitional prose sentences from remaining text.
  const remaining = lines.filter(Boolean).join(' ');
  if (remaining) {
    for (const sentence of splitSentences(remaining)) {
      const def = definitionalSentence(sentence);
      if (def) push(def.term, def.definition);
    }
  }

  // Pass 4: if still thin, mine salient sentences for cloze-only cards.
  if (cards.length < 5) {
    for (const sentence of splitSentences(text)) {
      if (cards.length >= 14) break;
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
      'We couldn\'t find clear study points. Try one idea per line, e.g. "Photosynthesis: how plants make food from sunlight", or upload a file.'
    );
  } else if (cards.length < 3) {
    warnings.push('Only found a few study points — add more lines or upload a fuller document to unlock every game.');
  }
  return { cards, warnings };
}

// Weighted subject detection (fixes miscategorisation) across many fields.
export function guessSubject(text) {
  const t = (text || '').toLowerCase();
  const fields = [
    ['Biology', ['cell', 'photosynth', 'dna', 'rna', 'organism', 'enzyme', 'mitochond', 'species', 'ecosystem', 'protein', 'gene', 'tissue', 'chromosome', 'bacteria', 'evolution', 'membrane']],
    ['Chemistry', ['atom', 'molecul', 'reaction', 'acid', 'base', 'ion', 'electron', 'compound', 'periodic', 'bond', 'oxid', 'catalyst', 'mole ', 'valence', 'isotope']],
    ['Physics', ['force', 'velocity', 'acceleration', 'energy', 'gravity', 'newton', 'quantum', 'voltage', 'momentum', 'wave', 'frequency', 'thermodynam', 'friction', 'kinetic']],
    ['History', ['war', 'empire', 'revolution', 'century', 'treaty', 'ancient', 'dynasty', 'monarch', 'president', 'colonial', 'medieval', 'reign']],
    ['Geography', ['river', 'mountain', 'climate', 'continent', 'capital', 'population', 'latitude', 'ecosystem', 'terrain', 'urban', 'plate tectonic']],
    ['Mathematics', ['equation', 'theorem', 'integral', 'derivative', 'algebra', 'geometry', 'function', 'matrix', 'polynomial', 'vector', 'probability', 'calculus']],
    ['Computer Science', ['algorithm', 'variable', 'array', 'loop', 'binary', 'compile', 'database', 'function', 'recursion', 'pointer', 'runtime', 'boolean', 'api', 'stack', 'queue']],
    ['Economics', ['market', 'demand', 'supply', 'inflation', 'gdp', 'trade', 'economy', 'revenue', 'fiscal', 'monetary', 'elasticity']],
    ['Medicine', ['patient', 'diagnosis', 'symptom', 'disease', 'treatment', 'anatomy', 'clinical', 'patholog', 'artery', 'neuron', 'hormone']],
    ['Psychology', ['behaviou', 'cognitive', 'stimulus', 'conditioning', 'perception', 'memory', 'neuros', 'disorder', 'therapy']],
    ['Law', ['statute', 'plaintiff', 'defendant', 'contract', 'liability', 'jurisdiction', 'tort', 'constitution', 'precedent']],
    ['Language', ['verb', 'noun', 'grammar', 'tense', 'vocabulary', 'pronoun', 'adjective', 'conjugat', 'syntax']],
  ];
  let best = 'General';
  let bestScore = 0;
  for (const [name, kws] of fields) {
    let score = 0;
    for (const kw of kws) if (t.includes(kw)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  return bestScore >= 1 ? best : 'General';
}
