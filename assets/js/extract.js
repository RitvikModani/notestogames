// extract.js — pull plain text out of uploaded PDF / Word / PowerPoint / text
// files, entirely in the browser. Uses the native DecompressionStream API to
// inflate the zip/deflate streams, so there are NO libraries to download — the
// app stays free, private (files never leave the device) and offline-capable.

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeXml(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(\w+);/g, (m, n) => (n in XML_ENTITIES ? XML_ENTITIES[n] : m));
}

async function inflate(bytes, format) {
  // format: 'deflate-raw' (zip members) or 'deflate' (pdf FlateDecode / zlib)
  const ds = new DecompressionStream(format);
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---- ZIP (docx / pptx are zip archives) ----
async function readZip(buffer) {
  const dv = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  // Find End Of Central Directory record (signature 0x06054b50), scanning back.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid zip');
  const count = dv.getUint16(eocd + 10, true);
  let ptr = dv.getUint32(eocd + 16, true); // central directory offset
  const entries = {};
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(ptr, true) !== 0x02014b50) break;
    const method = dv.getUint16(ptr + 10, true);
    const compSize = dv.getUint32(ptr + 20, true);
    const fnLen = dv.getUint16(ptr + 28, true);
    const extraLen = dv.getUint16(ptr + 30, true);
    const commentLen = dv.getUint16(ptr + 32, true);
    const localOff = dv.getUint32(ptr + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(ptr + 46, ptr + 46 + fnLen));
    entries[name] = { method, compSize, localOff };
    ptr += 46 + fnLen + extraLen + commentLen;
  }
  return {
    names: Object.keys(entries),
    async text(name) {
      const e = entries[name];
      if (!e) return '';
      const lfnLen = dv.getUint16(e.localOff + 26, true);
      const lexLen = dv.getUint16(e.localOff + 28, true);
      const start = e.localOff + 30 + lfnLen + lexLen;
      const data = bytes.subarray(start, start + e.compSize);
      const raw = e.method === 0 ? data : await inflate(data, 'deflate-raw');
      return new TextDecoder().decode(raw);
    },
  };
}

function textFromWordXml(xml) {
  // Keep paragraph structure: each <w:p> becomes a line.
  return xml
    .split(/<w:p[\s>]/)
    .map((p) => {
      const parts = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXml(m[1]));
      // <w:tab/> -> space, <w:br/> handled as space
      return parts.join('').replace(/<w:tab\/>/g, ' ');
    })
    .filter((l) => l.trim())
    .join('\n');
}

function textFromSlideXml(xml) {
  const paras = xml.split(/<a:p[\s>]/).map((p) => {
    const parts = [...p.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1]));
    return parts.join('');
  });
  return paras.filter((l) => l.trim()).join('\n');
}

async function extractDocx(buffer) {
  const zip = await readZip(buffer);
  let out = '';
  for (const name of ['word/document.xml']) {
    if (zip.names.includes(name)) out += textFromWordXml(await zip.text(name)) + '\n';
  }
  return out.trim();
}

async function extractPptx(buffer) {
  const zip = await readZip(buffer);
  const slides = zip.names
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => (+a.match(/(\d+)/)[1]) - (+b.match(/(\d+)/)[1]));
  const chunks = [];
  for (const s of slides) chunks.push(textFromSlideXml(await zip.text(s)));
  return chunks.filter(Boolean).join('\n');
}

// ---- PDF (best-effort text extraction) ----
function pdfUnescape(s) {
  return s
    .replace(/\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\t/g, ' ')
    .replace(/\\b/g, '').replace(/\\f/g, '')
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
}

function textFromContentStream(str) {
  let out = '';
  // Parenthesized strings passed to Tj / inside TJ arrays.
  const re = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>|\bT[dD]\b|\bT\*\b|\bTj\b|\bTJ\b/g;
  let m;
  while ((m = re.exec(str))) {
    const tok = m[0];
    if (tok[0] === '(') out += pdfUnescape(tok.slice(1, -1));
    else if (tok[0] === '<') {
      const hex = tok.slice(1, -1).replace(/\s+/g, '');
      for (let i = 0; i + 1 < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    } else if (tok === 'Td' || tok === 'TD' || tok === 'T*') out += '\n';
  }
  return out;
}

// Preferred path: the real pdf.js engine (vendored) — decodes embedded CID /
// Type0 fonts (exam papers, textbooks) that the lightweight parser can't.
// Loaded on demand only when a PDF is uploaded; absent in the single-file
// artifact build, where we fall back to the lightweight reader below.
let pdfjsPromise = null;
function loadPdfjs() {
  if (pdfjsPromise) return pdfjsPromise;
  const base = (typeof document !== 'undefined' && document.baseURI) || location.href;
  pdfjsPromise = import(new URL('assets/vendor/pdf.min.mjs', base).href).then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL('assets/vendor/pdf.worker.min.mjs', base).href;
    return lib;
  });
  return pdfjsPromise;
}

async function extractPdfJs(buffer) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  let out = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    let line = '';
    let lastY = null;
    for (const it of tc.items) {
      const y = it.transform ? it.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) { out += line.trim() + '\n'; line = ''; }
      line += it.str + (it.hasEOL ? '\n' : ' ');
      lastY = y;
    }
    out += line.trim() + '\n';
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function extractPdf(buffer) {
  // Try the real engine first; fall back to the lightweight reader.
  try {
    const text = await extractPdfJs(buffer);
    if (text && text.length > 20) return text;
  } catch (e) { /* fall back */ }
  return extractPdfLite(buffer);
}

async function extractPdfLite(buffer) {
  const bytes = new Uint8Array(buffer);
  const latin1 = new TextDecoder('latin1').decode(bytes);
  let text = '';
  // Iterate every "stream ... endstream" block.
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(latin1))) {
    const start = m.index + m[0].length;
    const end = latin1.indexOf('endstream', start);
    if (end < 0) continue;
    const chunk = bytes.subarray(start, end);
    let decoded = null;
    try {
      decoded = new TextDecoder('latin1').decode(await inflate(chunk, 'deflate'));
    } catch (e) {
      // Not a FlateDecode stream (or already plain) — try raw text.
      decoded = new TextDecoder('latin1').decode(chunk);
    }
    if (decoded && /\b(Tj|TJ)\b/.test(decoded)) text += textFromContentStream(decoded) + '\n';
    re.lastIndex = end;
  }
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Quality gate: reject binary/font gibberish so we never build garbage games.
// Mojibake from mis-decoded fonts is full of accented/symbol characters, so we
// measure the share of characters OUTSIDE normal Latin study text rather than
// just "is it a letter" (accented junk counts as letters).
function isGibberish(s) {
  if (!s || s.trim().length < 20) return true;
  const normal = (s.match(/[A-Za-z0-9\s.,;:!?'"()\[\]{}\-–—/%&+=*@#$°²³½×·…’‘“”éèêëàâäîïôöûüùçñáíóúÁÉÑ]/g) || []).length;
  const weirdRatio = 1 - normal / s.length;
  const asciiWords = (s.match(/[A-Za-z]{2,}/g) || []).length;
  return weirdRatio > 0.16 || asciiWords < 8;
}

/**
 * Extract text from a File. Returns { text, kind } or throws with a friendly message.
 */
export async function extractFile(file) {
  const name = (file.name || '').toLowerCase();
  const buffer = await file.arrayBuffer();
  let text = '';
  let kind = 'Text';
  try {
    if (name.endsWith('.pdf')) { text = await extractPdf(buffer); kind = 'PDF'; }
    else if (name.endsWith('.docx')) { text = await extractDocx(buffer); kind = 'Word'; }
    else if (name.endsWith('.pptx')) { text = await extractPptx(buffer); kind = 'PowerPoint'; }
    else if (name.endsWith('.doc') || name.endsWith('.ppt')) {
      throw new Error('Old .doc/.ppt formats aren\'t supported — please re-save as .docx / .pptx.');
    } else { text = new TextDecoder().decode(buffer); kind = /\.(txt|md|csv)$/.test(name) ? 'Text' : 'Text'; }
  } catch (err) {
    throw new Error(err.message && err.message.includes('re-save') ? err.message
      : 'Couldn\'t read that file. Try copy-pasting the text instead.');
  }

  if (isGibberish(text)) {
    throw new Error(kind === 'PDF'
      ? 'This PDF\'s text couldn\'t be read (it\'s likely a scan or uses embedded fonts). Tip: open it, copy the text, and paste it below — or upload the original slides/notes as .pptx / .docx.'
      : 'That file didn\'t contain readable text — try copy-pasting the text instead.');
  }
  return { text, kind };
}

export const ACCEPTED = '.pdf,.docx,.pptx,.txt,.md,.csv';
