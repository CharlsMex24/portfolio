// Run: cd agent && npm test   (plain node:test, no framework)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyCitation, assembleAnswer, extractiveAnswer } from '../../assets/js/agent-core.js';

const kb = JSON.parse(readFileSync(new URL('../../assets/data/kb.json', import.meta.url), 'utf8'));
const P = kb.passages;
const idx = (id) => P.findIndex((p) => p.id === id);
const cite = (id, text) => ({ type: 'char_location', cited_text: text, document_index: idx(id), document_title: '' });

test('knowledge base: unique ids, anchors and no em dashes', () => {
  assert.equal(new Set(P.map((p) => p.id)).size, P.length);
  for (const p of P) {
    assert.match(p.section, /^#[a-z]+$/, p.id);
    assert.ok(!/[—–]/.test(p.text), `dash in ${p.id}`);
  }
});

test('a real quote from the right passage is verified', () => {
  const v = verifyCitation(P, cite('borregos-results', 'with 373.2 km per kWh.'));
  assert.equal(v.id, 'borregos-results');
});

test('a quote from the wrong passage, an invented quote, or a bad index is rejected', () => {
  assert.equal(verifyCitation(P, cite('profile', 'with 373.2 km per kWh.')), null);
  assert.equal(verifyCitation(P, cite('borregos-results', 'first place at Shell Eco-marathon')), null);
  assert.equal(verifyCitation(P, { cited_text: 'Carlos', document_index: 999 }), null);
});

test('assembleAnswer keeps verified claims, drops failed ones, keeps connective text', () => {
  const content = [
    { type: 'text', text: 'Carlos ' },
    { type: 'text', text: 'got second place in Brazil', citations: [cite('borregos-results', 'The team won second place again at Shell Eco-marathon Brazil in August 2025')] },
    { type: 'text', text: ' and ' },
    { type: 'text', text: 'won first place in Americas', citations: [cite('borregos-results', 'won first place at Shell Eco-marathon Americas')] },
    { type: 'text', text: '.' },
  ];
  const a = assembleAnswer(P, content);
  assert.equal(a.verified, true);
  assert.equal(a.sources.length, 1);
  assert.equal(a.rejected, 1);
  assert.ok(!a.parts.some((p) => p.text.includes('first place')), 'the unverified claim must be gone');
  assert.deepEqual(a.parts.find((p) => p.refs.length).refs, [1]);
});

test('an answer with no verified citation is not verified', () => {
  const a = assembleAnswer(P, [{ type: 'text', text: 'He loves cats.' }]);
  assert.equal(a.verified, false);
});

test('offline mode finds the right passage in English and Spanish', () => {
  assert.equal(extractiveAnswer(P, 'What were the Shell Eco-marathon results?').sources[0].id, 'borregos-results');
  assert.equal(extractiveAnswer(P, '¿Qué análisis le hizo al exoesqueleto?').sources[0].id, 'exo-analysis');
  assert.equal(extractiveAnswer(P, 'What is his email?').sources[0].id, 'availability');
  assert.equal(extractiveAnswer(P, 'zzzz qqqq').verified, false);
});
