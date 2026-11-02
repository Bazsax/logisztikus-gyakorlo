// 4. feladattípus – Anyagszükséglet-tervezés (MRP), 6 pont
// Két változat: egyszintű (késztermék + 3 alkatrész) és többszintű (részegység + közös alkatrész),
// ahogy a vizsgafeladatsorokban (pl. franciaágy, kerékpárlámpa) szerepel.
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
// Többszintű: termék → részegység (1) + alkatrész (k) + közös alkatrész (a); részegység → közös alkatrész (b)
const MULTI = [
  { name: 'Franciaágy', sub: 'Ágykeret', part: ['Láb', 4], common: ['Csavar', 8, 4] },
  { name: 'Ruhásszekrény', sub: 'Szekrényváz', part: ['Láb', 4], common: ['Csavar', 10, 6] },
  { name: 'Íróasztal', sub: 'Fiókos elem', part: ['Asztalláb', 4], common: ['Csavar', 12, 8] },
  { name: 'Kerékpárlámpa', sub: 'Lámpatest', part: ['Elem', 2], common: ['Tömítés', 1, 2] },
];

export function generate(r, preset) {
  if (preset === 'vizsga') {
    return build({
      product: { name: 'Gamer szék', stock: 15, lead: 1, pack: 15 },
      demand: { 4: 130, 5: 330, 6: 210 },
      comps: [
        { name: 'Váz', qty: 1, stock: 6, lead: 2, pack: 10 },
        { name: 'Görgő', qty: 5, stock: 15, lead: 1, pack: 25 },
        { name: 'Csavar', qty: 10, stock: 210, lead: 1, pack: 250 },
      ],
    });
  }
  if (r.next() < 0.45) {
    const m = r.pick(MULTI);
    return build({
      multi: true,
      product: { name: m.name, stock: r.int(0, 20), lead: 1, pack: r.pick([1, 5, 10]) },
      demand: { 5: r.int(10, 30) * 10, 6: r.int(10, 30) * 10 },
      sub: { name: m.sub, qty: 1, stock: r.int(0, 15), lead: r.int(1, 2), pack: r.pick([1, 5, 10]) },
      comps: [
        { name: m.part[0], qty: m.part[1], stock: r.int(1, 12) * 5, lead: 1, pack: r.pick([10, 20, 25]) },
        { name: m.common[0], qty: m.common[1], qtySub: m.common[2], stock: r.int(2, 30) * 10, lead: 1, pack: r.pick([100, 250, 500]) },
      ],
    });
  }
  const prod = r.pick(PRODUCTS);
  const leads = r.shuffle([2, 1, 1]);
  return build({
    product: { name: cap(prod.name), stock: r.int(1, 6) * 5, lead: 1, pack: r.pick([5, 10, 15, 20, 25]) },
    demand: { 4: r.int(8, 30) * 10, 5: r.int(8, 40) * 10, 6: r.int(8, 30) * 10 },
    comps: prod.comps.map(([name, qty], i) => {
      const cp = qty === 1 ? r.pick([5, 10, 20]) : qty <= 5 ? r.pick([20, 25, 50]) : r.pick([100, 200, 250, 500]);
      return { name: cap(name), qty, stock: r.int(1, 12) * (qty >= 10 ? 20 : qty >= 4 ? 5 : 2), lead: leads[i], pack: cp };
    }),
  });
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Egy tétel MRP-rekordja. gross: {hét: mennyiség} */
function record(item, gross) {
  let onhand = item.stock;
  const rows = { gross: {}, open: {}, softOpen: {}, net: {}, rec: {}, order: {} };
  for (const w of WEEKS) {
    const g = gross[w] || 0;
    if (!g) { rows.softOpen[w] = onhand; continue; }
    rows.open[w] = onhand;
    rows.gross[w] = g;
    const net = Math.max(0, g - onhand);
    rows.net[w] = net;
    const rec = net > 0 ? ceilTo(net, item.pack) : 0;
    if (rec) { rows.rec[w] = rec; rows.order[w - item.lead] = rec; }
    onhand = onhand + rec - g;
  }
  return rows;
}

function sumGross(...parts) {
  const g = {};
  for (const [orders, q] of parts) for (const [w, v] of Object.entries(orders)) g[w] = (g[w] || 0) + v * q;
  return g;
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const prodRec = record(P.product, P.demand);
  const recs = [];
  let subRec = null;
  if (P.multi) {
    subRec = record(P.sub, sumGross([prodRec.order, 1]));
    recs.push(record(P.comps[0], sumGross([prodRec.order, P.comps[0].qty])));
    recs.push(record(P.comps[1], sumGross([prodRec.order, P.comps[1].qty], [subRec.order, P.comps[1].qtySub])));
  } else {
    P.comps.forEach((c) => recs.push(record(c, sumGross([prodRec.order, c.qty]))));
  }

  const dw = Object.keys(P.demand).map(Number);
  const items = [P.product, ...(P.multi ? [P.sub] : []), ...P.comps];
  t.statement = [
    p(`Egy ${P.product.name.toLowerCase()} összeszerelő vállalkozás anyagszükséglet-tervezését kell elkészíteni. Egy késztermékhez szükséges:`),
    ul(P.multi
      ? [`1 db ${P.sub.name.toLowerCase()} (ezt az üzemben szerelik össze, és ${P.comps[1].qtySub} db ${P.comps[1].name.toLowerCase()} épül bele)`, `${P.comps[0].qty} db ${P.comps[0].name.toLowerCase()}`, `${P.comps[1].qty} db ${P.comps[1].name.toLowerCase()} (közvetlenül a késztermékhez)`]
      : P.comps.map((c) => `${c.qty} db ${c.name.toLowerCase()}`)),
    p(`A termelési vezérprogram szerinti megrendelések: ${dw.map((w) => `${w}. hét: ${fmt(P.demand[w])} db`).join(', ')}.`),
    table(['Tétel', 'Raktárkészlet (db)', 'Átfutási idő (hét)', 'Egységcsomag / sorozatnagyság (db)'], items.map((c) => [c.name, fmt(c.stock), c.lead, fmt(c.pack)])),
    p(`Készítse el az MRP-rekordot mind a ${items.length} tételre! A rendelt mennyiség mindig az egységcsomag egész számú többszöröse.`),
  ];

  const toRow = (obj) => WEEKS.map((w) => (obj[w] === undefined ? null : obj[w]));
  const openRow = (rec) => WEEKS.map((w) => (rec.open[w] !== undefined ? rec.open[w] : { soft: rec.softOpen[w] }));
  const nT = items.length;
  const per = 6 / nT / 5;
  const addRec = (id, title, rec) => addGrid(t, id, title, COLS, [
    { label: 'Bruttó szükséglet', values: toRow(rec.gross), pts: per },
    { label: 'Nyitókészlet', values: openRow(rec), pts: per },
    { label: 'Nettó szükséglet', values: toRow(rec.net), pts: per },
    { label: 'Tervezett beérkezés', values: toRow(rec.rec), pts: per },
    { label: 'Tervezett rendelés', values: toRow(rec.order), pts: per },
  ]);
  addRec('prod', P.product.name, prodRec);
  if (P.multi) addRec('sub', `${P.sub.name} (1 db/termék)`, subRec);
  P.comps.forEach((c, i) => addRec(`c${i}`, P.multi && i === 1 ? `${c.name} (${c.qty} db/termék + ${c.qtySub} db/${P.sub.name.toLowerCase()})` : `${c.name} (${c.qty} db/termék)`, recs[i]));

  const firstOrderW = Math.min(...Object.keys(prodRec.order).map(Number));
  const c0 = P.comps[0];
  t.hints = [
    'Először a késztermék rekordját töltsd ki: a részegységek és alkatrészek bruttó szükséglete a szülőtétel TERVEZETT RENDELÉSÉBŐL jön (nem a vevői megrendelésből).',
    'Szükségleti héten: nettó = bruttó − nyitókészlet → a beérkezés a csomag felfelé kerekített többszöröse → a rendelés átfutási idővel korábban. Következő nyitókészlet = nyitó + beérkezés − bruttó. A nyitókészletet a szükségleti heteken kötelező kitölteni.'
      + (P.multi ? ` A közös alkatrész (${P.comps[1].name.toLowerCase()}) bruttó szükséglete KÉT forrásból adódik össze: a késztermék és a(z) ${P.sub.name.toLowerCase()} tervezett rendeléséből.` : ''),
    `Késztermék, első szükségleti hét: ${P.demand[dw[0]]} − ${P.product.stock} = ${prodRec.net[dw[0]]} → ${prodRec.rec[dw[0]] || 0} db. ${c0.name}: bruttó a ${firstOrderW}. héten ${prodRec.order[firstOrderW]} × ${c0.qty} = ${fmt(recs[0].gross[firstOrderW])} db.`,
  ];
  const explain = (name, rec, item) => p(`${name}: ` + Object.keys(rec.gross).map((w) => `${w}. hét bruttó ${fmt(rec.gross[w])}, nyitó ${fmt(rec.open[w])}, nettó ${fmt(rec.net[w])} → ${item.pack} többszörösére ${fmt(rec.rec[w] || 0)}, rendelés a ${w - item.lead}. héten`).join('; ') + '.');
  t.solution = [
    explain(P.product.name, prodRec, P.product),
    ...(P.multi ? [explain(P.sub.name, subRec, P.sub)] : []),
    ...P.comps.map((c, i) => explain(c.name, recs[i], c)),
    note('A nyitókészletet a vizsgamegoldások a szükségleti heteken adják meg; ha a többi hétre is helyesen beírod, az nem hiba (nem pontozzuk).'),
  ];
  return t;
}
