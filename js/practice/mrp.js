// 4. feladattípus – Anyagszükséglet-tervezés (MRP), 6 pont
import { makeTask, addGrid, ceilTo, p, ul, table, note } from './common.js';
import { fmt } from '../util.js';

export const meta = { kind: 'mrp', title: 'Anyagszükséglet-tervezés (MRP)', points: 6, exam: true, order: 4 };

const WEEKS = [1, 2, 3, 4, 5, 6];
const COLS = WEEKS.map((w) => `${w}.`);

const PRODUCTS = [
  { name: 'Gamer szék', comps: [['váz', 1], ['görgő', 5], ['rögzítő csavar', 10]] },
  { name: 'irodai asztal', comps: [['asztallap', 1], ['asztalláb', 4], ['csavar', 16]] },
  { name: 'kerékpár', comps: [['váz', 1], ['kerék', 2], ['küllő', 64]] },
  { name: 'könyvespolc', comps: [['oldallap', 2], ['polclap', 5], ['tipli', 20]] },
  { name: 'kerti pad', comps: [['ülőlap', 1], ['lábazat', 2], ['csavar', 12]] },
];

export function generate(r, preset) {
  let P;
  if (preset === 'vizsga') {
    P = {
      product: { name: 'Gamer szék', stock: 15, lead: 1, pack: 15 },
      demand: { 4: 130, 5: 330, 6: 210 },
      comps: [
        { name: 'Váz', qty: 1, stock: 6, lead: 2, pack: 10 },
        { name: 'Görgő', qty: 5, stock: 15, lead: 1, pack: 25 },
        { name: 'Csavar', qty: 10, stock: 210, lead: 1, pack: 250 },
      ],
    };
  } else {
    const prod = r.pick(PRODUCTS);
    const pack = r.pick([5, 10, 15, 20, 25]);
    const leads = r.shuffle([2, 1, 1]);
    P = {
      product: { name: cap(prod.name), stock: r.int(1, 6) * 5, lead: 1, pack },
      demand: { 4: r.int(8, 30) * 10, 5: r.int(8, 40) * 10, 6: r.int(8, 30) * 10 },
      comps: prod.comps.map(([name, qty], i) => {
        const cp = qty === 1 ? r.pick([5, 10, 20]) : qty <= 5 ? r.pick([20, 25, 50]) : r.pick([100, 200, 250, 500]);
        return { name: cap(name), qty, stock: r.int(1, 12) * (qty >= 10 ? 20 : qty >= 4 ? 5 : 2), lead: leads[i], pack: cp };
      }),
    };
  }
  return build(P);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Egy tétel MRP-rekordja. gross: {hét: mennyiség} */
function record(item, gross) {
  let onhand = item.stock;
  const rows = { gross: {}, open: {}, net: {}, rec: {}, order: {} };
  for (const w of WEEKS) {
    rows.open[w] = onhand;
    const g = gross[w] || 0;
    if (!g) continue;
    rows.gross[w] = g;
    const net = Math.max(0, g - onhand);
    rows.net[w] = net;
    const rec = net > 0 ? ceilTo(net, item.pack) : 0;
    if (rec) { rows.rec[w] = rec; rows.order[w - item.lead] = rec; }
    onhand = onhand + rec - g;
  }
  return rows;
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const prodRec = record(P.product, P.demand);
  const compRecs = P.comps.map((c) => {
    const g = {};
    for (const [w, q] of Object.entries(prodRec.order)) g[w] = q * c.qty;
    return record(c, g);
  });

  t.statement = [
    p(`Egy ${P.product.name.toLowerCase()} összeszerelő vállalkozás anyagszükséglet-tervezését kell elkészíteni. Az üzemben csak összeszerelést végeznek. Egy késztermékhez szükséges:`),
    ul(P.comps.map((c) => `${c.qty} db ${c.name.toLowerCase()}`)),
    p(`A termelési vezérprogram alapján a 4. héten ${fmt(P.demand[4])} db, az 5. héten ${fmt(P.demand[5])} db, a 6. héten ${fmt(P.demand[6])} db termékre van megrendelés.`),
    table(['Késztermék/részegység', 'Raktárkészlet (db)', 'Átfutási idő (hét)', 'Beszállítási egységcsomag (db/csomag)'], [
      [P.product.name, fmt(P.product.stock), P.product.lead, fmt(P.product.pack)],
      ...P.comps.map((c) => [c.name, fmt(c.stock), c.lead, fmt(c.pack)]),
    ]),
    p('Készítse el az MRP-rekordot mind a négy tételre!'),
  ];

  const toRow = (obj) => WEEKS.map((w) => (obj[w] === undefined ? null : obj[w]));
  const addRec = (id, title, rec) => addGrid(t, id, title, COLS, [
    { label: 'Bruttó szükséglet', values: toRow(rec.gross), pts: 0.3 },
    { label: 'Nyitókészlet', values: toRow(rec.open), pts: 0.3 },
    { label: 'Nettó szükséglet', values: toRow(rec.net), pts: 0.3 },
    { label: 'Tervezett beérkezés', values: toRow(rec.rec), pts: 0.3 },
    { label: 'Tervezett rendelés', values: toRow(rec.order), pts: 0.3 },
  ]);
  addRec('prod', P.product.name, prodRec);
  P.comps.forEach((c, i) => addRec(`c${i}`, `${c.name} (${c.qty} db/termék)`, compRecs[i]));

  const c0 = P.comps[0];
  const firstOrderW = Math.min(...Object.keys(prodRec.order).map(Number));
  t.hints = [
    'Először a késztermék rekordját töltsd ki, mert a részegységek bruttó szükséglete a késztermék TERVEZETT RENDELÉSÉBŐL jön (nem a vevői megrendelésből).',
    'Minden héten: nettó = bruttó − nyitókészlet (ha pozitív) → a beérkezés az egységcsomag felfelé kerekített többszöröse → a rendelés az átfutási idővel korábbi héten van. Következő heti nyitókészlet = nyitó + beérkezés − bruttó. A nyitókészlet sort minden hétre kitöltjük.',
    `Késztermék, 4. hét: ${P.demand[4]} − ${P.product.stock} = ${prodRec.net[4]} → ${prodRec.rec[4] || 0} db (${P.product.pack}-ös csomag), rendelés a 3. héten. ${c0.name}: bruttó a ${firstOrderW}. héten ${prodRec.order[firstOrderW]} × ${c0.qty} = ${compRecs[0].gross[firstOrderW]} db.`,
  ];
  const explain = (name, rec, item) => p(`${name}: ` + Object.keys(rec.gross).map((w) => `${w}. hét bruttó ${fmt(rec.gross[w])}, nyitó ${fmt(rec.open[w])}, nettó ${fmt(rec.net[w])} → ${item.pack}-ös csomagra ${fmt(rec.rec[w] || 0)}, rendelés a ${w - item.lead}. héten`).join('; ') + '.');
  t.solution = [
    explain(P.product.name, prodRec, P.product),
    ...P.comps.map((c, i) => explain(`${c.name} (késztermék rendelése × ${c.qty})`, compRecs[i], c)),
    note('A darabjegyzék szorzóit mindig a szülőtétel tervezett rendelésére alkalmazzuk. A rendelt mennyiség mindig az egységcsomag felfelé kerekített többszöröse.'),
  ];
  return t;
}
