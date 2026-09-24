/* The part of the portfolio agent that does not need AI. Shared by the browser and the Cloudflare Worker.
   1. verifyCitation: a quote counts only if it is literally inside the passage it points to.
   2. assembleAnswer: turns Claude's cited text blocks into { parts, sources } and drops unverified claims.
   3. extractiveAnswer: the offline mode. Finds the closest passage with plain keyword scoring, no model. */

export const normalize = (s) =>
  String(s).normalize('NFKC').toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ').trim();

export function verifyCitation(passages, citation) {
  const p = passages[citation?.document_index];
  const quote = typeof citation?.cited_text === 'string' ? citation.cited_text.trim() : '';
  if (!p || quote.length < 3) return null;
  if (!normalize(p.text).includes(normalize(quote))) return null;
  return { id: p.id, title: p.title, section: p.section, quote };
}

/** content: the `content` array of a Messages API response with citations enabled. */
export function assembleAnswer(passages, content) {
  const sources = [];
  const index = new Map();
  const parts = [];
  let cited = 0, rejected = 0;
  for (const block of content) {
    if (block.type !== 'text') continue;
    const citations = block.citations || [];
    const refs = [];
    for (const c of citations) {
      cited++;
      const v = verifyCitation(passages, c);
      if (!v) { rejected++; continue; }
      const key = v.id + '|' + normalize(v.quote);
      if (!index.has(key)) { index.set(key, sources.length + 1); sources.push(v); }
      refs.push(index.get(key));
    }
    // A claim whose every citation failed is dropped. Text with no citations is the model's connective wording.
    if (citations.length && !refs.length) continue;
    parts.push({ text: block.text, refs: [...new Set(refs)] });
  }
  return { parts, sources, cited, rejected, verified: sources.length > 0 };
}

// ---------- Offline mode: keyword scoring (a small TF-IDF), good enough for "closest passage"
const STOP = new Set(('a an the of and or to in on at for with by is are was were be been it its this that these what who whom how ' +
  'why when where does did do has have had his he him carlos velasco moreno about can could tell me you your ' +
  'de la el los las y o u en un una unos unas que del al por con para es son fue ser su sus se lo le les mi me ' +
  'como cual cuales quien donde cuando hizo hace tiene tuvo sobre esta este eso esa hay muy mas').split(' '));
const SYN = {
  exoesqueleto: 'exoskeleton', silla: 'chair', carro: 'car', coche: 'car', auto: 'car', vehiculo: 'vehicle',
  experiencia: 'experience', trabajo: 'work', habilidades: 'skills', idiomas: 'languages', idioma: 'languages',
  ingles: 'english', espanol: 'spanish', correo: 'email', contacto: 'contact', practicas: 'internships',
  becario: 'scholar', investigacion: 'research', certificados: 'certifications', certificaciones: 'certifications',
  estudia: 'student', estudios: 'student', carrera: 'mechatronics', medicina: 'medicine', agente: 'agent',
  robot: 'robot', brazo: 'arm', sitio: 'website', pagina: 'website', resultados: 'results', lugar: 'place',
  segundo: 'second', proyectos: 'project', proyecto: 'project', analisis: 'analysis', esfuerzo: 'stress',
  carga: 'load', pandeo: 'buckling', prototipo: 'prototype', impresion: 'printed', equipo: 'team',
  premios: 'place', logros: 'place', universidad: 'tecnologico', promedio: 'gpa', calificaciones: 'gpa',
};
export const tokenize = (s) =>
  normalize(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => SYN[w] || w);

export function searchPassages(passages, question, k = 2) {
  const q = new Set(tokenize(question));
  if (!q.size) return [];
  const docs = passages.map((p) => tokenize(p.title + ' ' + p.text));
  const df = new Map();
  docs.forEach((d) => new Set(d).forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
  return passages.map((p, i) => {
    const tf = new Map();
    docs[i].forEach((w) => tf.set(w, (tf.get(w) || 0) + 1));
    let score = 0;
    for (const w of q) if (tf.has(w)) score += Math.log(1 + passages.length / df.get(w)) * (1 + Math.log(tf.get(w)));
    return { p, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}

export function extractiveAnswer(passages, question) {
  const [best] = searchPassages(passages, question, 1);
  if (!best) return { parts: [], sources: [], cited: 0, rejected: 0, verified: false, mode: 'offline' };
  const q = new Set(tokenize(question));
  const sentences = best.p.text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const pick = sentences.map((s) => ({ s, hits: tokenize(s).filter((w) => q.has(w)).length }))
    .sort((a, b) => b.hits - a.hits)[0].s;
  return {
    parts: [{ text: pick, refs: [1] }],
    sources: [{ id: best.p.id, title: best.p.title, section: best.p.section, quote: pick }],
    cited: 1, rejected: 0, verified: true, mode: 'offline',
  };
}

export const looksSpanish = (s) => /[¿¡áéíóúñ]|\b(que|qué|como|cómo|cual|cuál|quien|quién|hizo|tiene|donde|dónde|sobre|trabaja|estudia)\b/i.test(s);
