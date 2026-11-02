// Munkamenetek összeállítása, elemek elérése, pontozás.
import { rng, newSeed } from './util.js';
import { makeView, emptyAnswer, scoreTheory } from './theory.js';
import { GENERATORS, makePractice } from './practice/index.js';
import { scoreTask } from './practice/common.js';
import { settings, stats } from './store.js';

export let BANK = [];
export const BANK_BY_ID = {};
export async function loadBank() {
  const res = await fetch('data/theory.json', { cache: 'no-cache' });
  BANK = await res.json();
  for (const q of BANK) BANK_BY_ID[q.id] = q;
  return BANK;
}
export const TOPICS = () => [...new Set(BANK.map((q) => q.topic))];

const practiceCache = new Map();
export function practiceOf(item) {
  const key = JSON.stringify(item.ref);
  if (!practiceCache.has(key)) practiceCache.set(key, makePractice(item.ref));
  return practiceCache.get(key);
}
export const questionOf = (item) => (item.k === 't' ? BANK_BY_ID[item.id] : practiceOf(item));

function pickTheory(r, { count, topics, essays, essayCount, exclude = [] }) {
  let pool = BANK.filter((q) => (!topics?.length || topics.includes(q.topic)) && !exclude.includes(q.id) && (settings.calcTheory || !q.calc));
  const nonEssay = r.shuffle(pool.filter((q) => q.type !== 'essay'));
  const essayPool = essays ? r.shuffle(pool.filter((q) => q.type === 'essay')) : [];
  let nE = essays ? (essayCount ?? Math.round(count * 0.15)) : 0;
  nE = Math.min(nE, essayPool.length);
  const chosen = [...nonEssay.slice(0, count - nE), ...essayPool.slice(0, nE)];
  return chosen.map((q) => ({ k: 't', id: q.id, view: makeView(q, r) }));
}

const FIXED = ['vizsga', 'v23'];
function practiceItems(kinds, preset, bonus = true) {
  const fixed = FIXED.includes(preset) ? preset : undefined;
  const items = kinds.map((kind) => ({ k: 'p', ref: { kind, seed: newSeed(), preset: fixed } }));
  // A 23-as feladatlap két bónuszfeladata (második MRP és termelési feladat)
  if (fixed === 'v23' && bonus) ['mrp', 'production'].filter((k) => kinds.includes(k)).forEach((kind) => items.push({ k: 'p', ref: { kind, seed: newSeed(), preset: 'v23b' } }));
  return items;
}

/**
 * opts: {mode, count, topics, kinds, preset, ids}
 * mode: theory | practice | mixed | exam | review
 */
export function createSession(opts) {
  const seed = newSeed();
  const r = rng(seed);
  const s = {
    id: `S${Date.now().toString(36)}${seed.toString(36).slice(0, 4)}`.toUpperCase(),
    mode: opts.mode, created: Date.now(), items: [], sections: null,
    ans: {}, hint: {}, checked: {}, revealed: {}, expl: {}, ai: {}, submitted: false,
    timer: null,
  };
  const essays = settings.essays && opts.essays !== false;
  if (opts.mode === 'theory') {
    s.title = 'Elméleti gyakorlás';
    s.items = pickTheory(r, { count: opts.count, topics: opts.topics, essays });
  } else if (opts.mode === 'practice') {
    s.title = { vizsga: 'Gyakorlati feladatok – a Gamer székes mintavizsga adataival', v23: 'Gyakorlati feladatok – a 23-as feladatlap adataival' }[opts.preset] || 'Gyakorlati feladatok';
    s.items = practiceItems(opts.kinds, opts.preset);
  } else if (opts.mode === 'mixed') {
    s.title = 'Vegyes gyakorlás';
    const t = pickTheory(r, { count: opts.count, topics: opts.topics, essays, essayCount: essays ? 1 : 0 });
    const p = practiceItems(r.sample(opts.kinds, Math.min(opts.pCount, opts.kinds.length)));
    // Elméleti és gyakorlati elemek összefésülése
    const all = [];
    const step = Math.max(1, Math.round(t.length / (p.length + 1)));
    t.forEach((it, i) => { all.push(it); if ((i + 1) % step === 0 && p.length) all.push(p.shift()); });
    s.items = [...all, ...p];
  } else if (opts.mode === 'exam') {
    s.title = 'Vizsgaszimuláció';
    const t = pickTheory(r, { count: settings.examTheory, essays, essayCount: essays ? settings.examEssays : 0 });
    const kinds = GENERATORS.filter((g) => g.meta.exam).map((g) => g.meta.kind);
    const p = practiceItems(kinds, opts.preset, false);
    s.items = [...t, ...p];
    s.sections = [
      { name: 'Írásbeli (elmélet)', from: 0, to: t.length, minutes: settings.examWrittenMin, weight: settings.weightWritten },
      { name: 'Projektfeladat (gyakorlat)', from: t.length, to: t.length + p.length, minutes: settings.examProjectMin, weight: settings.weightProject },
    ];
    s.timer = { started: Date.now(), section: 0, sectionStart: [Date.now(), null] };
  } else if (opts.mode === 'review') {
    s.title = 'Hibás kérdések újragyakorlása';
    const weak = Object.entries(stats.q)
      .filter(([id, v]) => BANK_BY_ID[id] && v.seen > 0 && v.last < 1)
      .sort((a, b) => a[1].sum / a[1].seen - b[1].sum / b[1].seen)
      .slice(0, opts.count)
      .map(([id]) => id);
    s.items = weak.map((id) => ({ k: 't', id, view: makeView(BANK_BY_ID[id], r) }));
  } else if (opts.mode === 'ids') {
    s.title = opts.title || 'Kiválasztott kérdések';
    s.items = opts.ids.map((id) => ({ k: 't', id, view: makeView(BANK_BY_ID[id], r) }));
  }
  s.items.forEach((it, i) => { if (it.k === 't') s.ans[i] = emptyAnswer(BANK_BY_ID[it.id], it.view); else s.ans[i] = {}; });
  return s;
}

export function itemScore(s, i) {
  const it = s.items[i];
  if (it.k === 't') return scoreTheory(BANK_BY_ID[it.id], s.ans[i], settings);
  return scoreTask(practiceOf(it), s.ans[i]);
}

export function sumScores(s, from = 0, to = s.items.length) {
  let got = 0; let max = 0;
  for (let i = from; i < to; i++) { const r = itemScore(s, i); got += r.got; max += r.max; }
  return { got: Math.round(got * 100) / 100, max: Math.round(max * 100) / 100, pct: max ? (got / max) * 100 : 0 };
}

export function grade(pct) {
  if (pct >= 90) return { n: 5, t: 'Jeles (5)' };
  if (pct >= 80) return { n: 4, t: 'Jó (4)' };
  if (pct >= 70) return { n: 3, t: 'Közepes (3)' };
  if (pct >= 50) return { n: 2, t: 'Elégséges (2)' };
  return { n: 1, t: 'Elégtelen (1)' };
}

export function sectionOf(s, i) {
  if (!s.sections) return null;
  return s.sections.findIndex((sec) => i >= sec.from && i < sec.to);
}
