// Kiegészítő típus – Készletértékelés FIFO, LIFO és súlyozott átlagár szerint (nem része a mintavizsgának)
import { makeTask, addForm, p, table, note , step, f, tip } from './common.js';
import { fmt, roundTo } from '../util.js';

export const meta = { kind: 'valuation', title: 'Készletértékelés: FIFO, LIFO, súlyozott átlagár', points: 3, exam: false, order: 9 };

export function generate(r) {
  const n = r.int(2, 4);
  const lots = [];
  for (let i = 0; i < n; i++) lots.push({ date: `${['Március', 'Április', 'Május', 'Június'][i]} ${r.int(1, 28)}.`, q: r.int(5, 20) * 10, price: r.int(8, 30) * 10 });
  const total = lots.reduce((s, l) => s + l.q, 0);
  const use = Math.round(total * (0.3 + r.next() * 0.5) / 10) * 10;
  return build({ lots, use });
}

function consume(lots, use) {
  let left = use; let value = 0; const parts = [];
  for (const l of lots) { if (!left) break; const q = Math.min(left, l.q); value += q * l.price; parts.push(`${q} × ${l.price}`); left -= q; }
  return { value, parts };
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const fifo = consume(P.lots, P.use);
  const lifo = consume([...P.lots].reverse(), P.use);
  const totQ = P.lots.reduce((s, l) => s + l.q, 0);
  const totV = P.lots.reduce((s, l) => s + l.q * l.price, 0);
  const avgP = totV / totQ;
  const avgV = roundTo(avgP * P.use, 0);
  t.statement = [
    p('Egy vállalat a következő beszerzéseket végezte (nyitókészlet nem volt):'),
    table(['Időpont', 'Mennyiség (db)', 'Egységár (Ft/db)'], P.lots.map((l) => [l.date, fmt(l.q), fmt(l.price)])),
    p(`Az időszakban ${fmt(P.use)} db-ot használtak fel. Mennyi a felhasznált készlet értéke az egyes módszerekkel? (Ft, egészre kerekítve)`),
  ];
  addForm(t, 'v', null, ['Módszer', 'Felhasználás értéke (Ft)'], [
    { label: 'FIFO (először be, először ki)', field: { expect: fifo.value, unit: 'Ft' }, pts: 1 },
    { label: 'LIFO (utoljára be, először ki)', field: { expect: lifo.value, unit: 'Ft' }, pts: 1 },
    { label: 'Súlyozott átlagár', field: { expect: avgV, tol: 1.01, unit: 'Ft' }, pts: 1 },
  ]);
  t.hints = [
    'FIFO: a legrégebbi beszerzésből fogyasztunk először. LIFO: a legutolsó beszerzésből. Súlyozott átlagár: az összes beszerzés értéke ÷ összes mennyiség.',
    'Rétegenként haladj: ha egy beszerzési tétel elfogy, a következőből veszed a maradékot. Az átlagárat szorozd a felhasznált mennyiséggel.',
    `Összes beszerzés: ${fmt(totQ)} db, ${fmt(totV)} Ft → átlagár ${fmt(avgP, 2)} Ft/db.`,
  ];
  t.solution = [
    p(`FIFO: ${fifo.parts.join(' + ')} = ${fmt(fifo.value)} Ft`),
    p(`LIFO: ${lifo.parts.join(' + ')} = ${fmt(lifo.value)} Ft`),
    p(`Átlagár: ${fmt(totV)} ÷ ${fmt(totQ)} = ${fmt(avgP, 2)} Ft/db → ${fmt(avgP, 2)} × ${fmt(P.use)} = ${fmt(avgV)} Ft`),
    note('Emelkedő áraknál a LIFO adja a legmagasabb felhasználási értéket (és a legalacsonyabb zárókészletet).'),
  ];

  t.walkthrough = [
    step('A három módszer lényege', p('A felhasznált mennyiség ugyanaz, csak az a kérdés, MELYIK beszerzési áron számoljuk el.'),
      f('FIFO: először a legrégebbi tételből fogyasztunk\nLIFO: először a legutolsó (legfrissebb) tételből\nSúlyozott átlagár: összes beszerzési érték ÷ összes mennyiség')),
    step('FIFO – rétegenként a legrégebbitől', f(`${fifo.parts.join(' + ')} = ${fmt(fifo.value)} Ft`), tip('Ha egy tétel elfogy, a következő (újabb) tételből veszed a maradékot.')),
    step('LIFO – rétegenként a legújabbtól', f(`${lifo.parts.join(' + ')} = ${fmt(lifo.value)} Ft`)),
    step('Súlyozott átlagár', f(`összes mennyiség: ${P.lots.map((l) => l.q).join(' + ')} = ${fmt(totQ)} db\nösszes érték: ${P.lots.map((l) => `${l.q}×${l.price}`).join(' + ')} = ${fmt(totV)} Ft\nátlagár = ${fmt(totV)} ÷ ${fmt(totQ)} = ${fmt(avgP, 2)} Ft/db\nfelhasználás = ${fmt(avgP, 2)} × ${fmt(P.use)} = ${fmt(avgV)} Ft`)),
  ];
  return t;
}
