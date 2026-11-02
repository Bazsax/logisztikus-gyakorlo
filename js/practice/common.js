// Gyakorlati feladatok közös építőelemei és ellenőrzése.
import { fmt, parseNum } from '../util.js';

/**
 * Feladatmodell:
 * { kind, title, points, statement:[blokk], parts:[rész], fields:{fid:mező}, scoring:[egység], hints:[3], solution:[blokk] }
 * Blokk: {type:'p', text} | {type:'ul', items} | {type:'table', head, rows} | {type:'note', text}
 * Rész: {type:'grid', title, cols, rows:[{label, fids, ptsLabel}]} | {type:'form', title, head, rows:[{label, fids:[...], ptsLabel}]}
 * Mező: {expect: number|string|null, dec, tol, accept:[], type:'num'|'select', options, unit}
 *   expect === null: a hivatalos megoldásban üres cella (nem pontozzuk, de jelezzük, ha kitöltötted)
 * Egység: {fids, pts, mode:'each'|'all'}
 */
export function makeTask(t) {
  return { fields: {}, scoring: [], parts: [], hints: [], solution: [], ...t };
}

/** Rácsos (DRP/MRP-szerű) rész. rows: [{label, values:[...], pts}] */
export function addGrid(task, id, title, cols, rows) {
  const part = { type: 'grid', title, cols, rows: [] };
  rows.forEach((row, r) => {
    const fids = [];
    const scored = [];
    row.values.forEach((v0, c) => {
      let v = v0;
      const fid = `${id}.${r}.${c}`;
      const soft = v && typeof v === 'object' ? v.soft : undefined;
      const val = v && typeof v === 'object' ? null : v;
      task.fields[fid] = { type: 'num', expect: val === undefined ? null : val, dec: 0, ...(soft !== undefined ? { soft } : {}), ...(row.field || {}) };
      v = val;
      fids.push(fid);
      if (v !== null && v !== undefined) scored.push(fid);
    });
    part.rows.push({ label: row.label, fids, ptsLabel: row.ptsLabel ?? (row.pts ? ptsText(row.pts, scored.length) : '') });
    if (scored.length && row.pts) task.scoring.push({ fids: scored, pts: row.pts, mode: 'each' });
  });
  task.parts.push(part);
  return part;
}

/** Űrlap-sor alapú rész (Kérdés | Mellékszámítás | Eredmény). rows: [{label, field, pts, calc}] */
export function addForm(task, id, title, head, rows) {
  const part = { type: 'form', title, head, rows: [] };
  rows.forEach((row, r) => {
    const fids = [];
    (row.fields || [row.field]).forEach((f, c) => {
      const fid = `${id}.${r}.${c}`;
      task.fields[fid] = { type: 'num', dec: 0, ...f };
      fids.push(fid);
    });
    part.rows.push({ label: row.label, fids, calc: row.calc !== false, ptsLabel: row.ptsLabel ?? (row.pts ? fmt(row.pts) + ' pont' : '') });
    if (row.pts) task.scoring.push({ fids, pts: row.pts, mode: row.mode || 'all' });
  });
  task.parts.push(part);
  return part;
}

function ptsText(total, n) {
  if (!n) return '';
  const each = total / n;
  return n === 1 ? fmt(total) + ' p' : `${n}×${fmt(Math.round(each * 1000) / 1000)}`;
}

/** Egy mező ellenőrzése. Vissza: 'ok' | 'bad' | 'empty' | 'extra' (üresnek kellene lennie) | 'blank' (üres és üres is a jó) */
export function checkField(field, raw) {
  const empty = raw === undefined || raw === null || String(raw).trim() === '';
  if (field.expect === null) {
    if (empty) return 'blank';
    if (field.type === 'num' && parseNum(raw) === 0) return 'blank';
    if (field.soft !== undefined && field.type === 'num' && Math.abs(parseNum(raw) - field.soft) < 1e-9) return 'blank';
    return 'extra';
  }
  if (empty) {
    if (field.type === 'num' && field.expect === 0 && field.blankOk !== false) return 'ok';
    return 'empty';
  }
  if (field.type === 'select') return String(raw) === String(field.expect) ? 'ok' : 'bad';
  const v = parseNum(raw, field.dec || 0);
  if (v === null || Number.isNaN(v)) return 'bad';
  const targets = [field.expect, ...(field.accept || [])];
  const tol = field.tol ?? (0.5 * 10 ** -(field.dec ?? 0) + 1e-9);
  return targets.some((t) => Math.abs(v - t) <= tol) ? 'ok' : 'bad';
}

/** Pontszám egy feladatra a felhasználó (vagy AI) válaszai alapján. */
export function scoreTask(task, answers = {}) {
  let got = 0;
  for (const unit of task.scoring) {
    const res = unit.fids.map((fid) => checkField(task.fields[fid], answers[fid]));
    if (unit.mode === 'all') { if (res.every((r) => r === 'ok')) got += unit.pts; }
    else got += unit.pts * (res.filter((r) => r === 'ok').length / unit.fids.length);
  }
  return { got: Math.round(got * 100) / 100, max: task.points };
}

/** A mező várt értéke szövegesen (megoldás megjelenítéshez). */
export function expectText(field) {
  if (field.expect === null) return '';
  if (field.type === 'select') return String(field.expect);
  const main = fmt(field.expect, field.showDec ?? null);
  const acc = [...new Set((field.accept || []).filter((a) => Math.abs(a - field.expect) > 1e-9))];
  return acc.length ? `${main} (elfogadott: ${acc.map((a) => fmt(a)).join(', ')})` : main;
}

/** Kiegészítő segéd: felfelé kerekítés adott többszörösre. */
export const ceilTo = (x, step) => Math.ceil(x / step - 1e-9) * step;

export const p = (text) => ({ type: 'p', text });
export const ul = (items) => ({ type: 'ul', items });
export const table = (head, rows) => ({ type: 'table', head, rows });
export const note = (text) => ({ type: 'note', text });
/** Levezetés-lépés: {title, blocks} – a blokkok: p, ul, table, note, f (képlet), tip */
export const step = (title, ...blocks) => ({ title, blocks: blocks.flat().filter(Boolean) });
export const f = (text) => ({ type: 'f', text });
export const tip = (text) => ({ type: 'tip', text });
