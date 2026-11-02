// 4. feladattípus – Anyagszükséglet-tervezés (MRP), 6 pont
// Két változat: egyszintű (késztermék + 3 alkatrész) és többszintű (részegység + közös alkatrész),
// ahogy a vizsgafeladatsorokban (pl. franciaágy, kerékpárlámpa) szerepel.
import { makeTask, addGrid, ceilTo, p, ul, table, note, step, f, tip } from './common.js';
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
  if (preset === 'v23' || preset === 'v23b') {
    const b = preset === 'v23b';
    return build({
      multi: true,
      product: b ? { name: 'Ruhásszekrény', stock: 15, lead: 1, pack: 1 } : { name: 'Franciaágy', stock: 8, lead: 1, pack: 1 },
      demand: b ? { 5: 100, 6: 75 } : { 5: 220, 6: 175 },
      sub: b ? { name: 'Szekrényváz', qty: 1, stock: 6, lead: 1, pack: 1 } : { name: 'Ágykeret', qty: 1, stock: 3, lead: 2, pack: 1 },
      comps: b
        ? [{ name: 'Láb', qty: 4, stock: 53, lead: 2, pack: 40 }, { name: 'Csavar', qty: 10, qtySub: 6, stock: 89, lead: 1, pack: 250 }]
        : [{ name: 'Láb', qty: 4, stock: 49, lead: 1, pack: 20 }, { name: 'Csavar', qty: 8, qtySub: 4, stock: 210, lead: 1, pack: 500 }],
    });
  }
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
  // A hivatalos megoldás a nyitókészlet-sorban az utolsó szükségleti hét UTÁNI hetet (záró készlet) is kéri, ha belefér a táblázatba
  const lastG = Math.max(...Object.keys(rows.gross).map(Number));
  if (Number.isFinite(lastG) && lastG + 1 <= WEEKS[WEEKS.length - 1]) { rows.open[lastG + 1] = rows.softOpen[lastG + 1]; delete rows.softOpen[lastG + 1]; }
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
  // Pontozás a Gamer székes vizsgalap javítókulcsa szerint: a késztermék és az egyszerű alkatrészek bruttó szükséglete
  // nem pontozott („---”), a nyitókészlet 0,1 p/cella; az utolsó tételnél (csavar) a bruttó és a rendelés 0,2 p/cella.
  const cnt = (o) => Object.keys(o).length;
  const plan = [prodRec, ...(P.multi ? [subRec] : []), ...recs].map((rec, k, all) => {
    const last = k === all.length - 1 && k > 0;
    const w = last ? { g: 0.2, o: 0.1, n: 0.1, r: 0.1, q: 0.2 } : { g: 0, o: 0.1, n: 0.1, r: 0.1, q: 0.1 };
    return { rec, pts: { g: w.g * cnt(rec.gross), o: w.o * cnt(rec.open), n: w.n * cnt(rec.net), r: w.r * cnt(rec.rec), q: w.q * cnt(rec.order) } };
  });
  const rawTotal = plan.reduce((s, x) => s + Object.values(x.pts).reduce((a, b) => a + b, 0), 0);
  const k6 = 6 / rawTotal; // a 6 pontra skálázás (a Gamer székes adatoknál pontosan 1)
  const addRec = (id, title, { rec, pts }) => addGrid(t, id, title, COLS, [
    { label: 'Bruttó szükséglet', values: toRow(rec.gross), pts: pts.g * k6, ptsLabel: pts.g ? undefined : '---' },
    { label: 'Nyitókészlet', values: openRow(rec), pts: pts.o * k6 },
    { label: 'Nettó szükséglet', values: toRow(rec.net), pts: pts.n * k6 },
    { label: 'Tervezett beérkezés', values: toRow(rec.rec), pts: pts.r * k6 },
    { label: 'Tervezett rendelés', values: toRow(rec.order), pts: pts.q * k6 },
  ]);
  let k = 0;
  addRec('prod', P.product.name, plan[k++]);
  if (P.multi) addRec('sub', `${P.sub.name} (1 db/termék)`, plan[k++]);
  P.comps.forEach((c, i) => addRec(`c${i}`, P.multi && i === 1 ? `${c.name} (${c.qty} db/termék + ${c.qtySub} db/${P.sub.name.toLowerCase()})` : `${c.name} (${c.qty} db/termék)`, plan[k++]));

  const firstOrderW = Math.min(...Object.keys(prodRec.order).map(Number));
  const c0 = P.comps[0];
  t.hints = [
    'Először a késztermék rekordját töltsd ki: a részegységek és alkatrészek bruttó szükséglete a szülőtétel TERVEZETT RENDELÉSÉBŐL jön (nem a vevői megrendelésből).',
    'Szükségleti héten: nettó = bruttó − nyitókészlet → a beérkezés a csomag felfelé kerekített többszöröse → a rendelés átfutási idővel korábban. Következő nyitókészlet = nyitó + beérkezés − bruttó. A nyitókészletet a szükségleti heteken és az utolsó szükségleti hetet követő héten (záró készlet) kell kitölteni.'
      + (P.multi ? ` A közös alkatrész (${P.comps[1].name.toLowerCase()}) bruttó szükséglete KÉT forrásból adódik össze: a késztermék és a(z) ${P.sub.name.toLowerCase()} tervezett rendeléséből.` : ''),
    `Késztermék, első szükségleti hét: ${P.demand[dw[0]]} − ${P.product.stock} = ${prodRec.net[dw[0]]} → ${prodRec.rec[dw[0]] || 0} db. ${c0.name}: bruttó a ${firstOrderW}. héten ${prodRec.order[firstOrderW]} × ${c0.qty} = ${fmt(recs[0].gross[firstOrderW])} db.`,
  ];
  const explain = (name, rec, item) => p(`${name}: ` + Object.keys(rec.gross).map((w) => `${w}. hét bruttó ${fmt(rec.gross[w])}, nyitó ${fmt(rec.open[w])}, nettó ${fmt(rec.net[w])} → ${item.pack} többszörösére ${fmt(rec.rec[w] || 0)}, rendelés a ${w - item.lead}. héten`).join('; ') + '.');
  t.solution = [
    explain(P.product.name, prodRec, P.product),
    ...(P.multi ? [explain(P.sub.name, subRec, P.sub)] : []),
    ...P.comps.map((c, i) => explain(c.name, recs[i], c)),
    note('A Gamer székes javítókulcs szerint a nyitókészlet-sorban a szükségleti heteket és az azt követő hetet (záró készlet) kell kitölteni. A késztermék és az egyszerű alkatrészek bruttó szükséglete nem pontozott (---), a többi hét nyitókészlete sem – ha helyesen beírod, az nem hiba.'),
  ];

  const weekLines = (rec, item) => Object.keys(rec.gross).map((w) => {
    const W = Number(w); const net = rec.net[W]; const rc = rec.rec[W] || 0;
    return f(`${W}. hét: bruttó ${fmt(rec.gross[W])}, nyitó ${fmt(rec.open[W])} → nettó = ${fmt(rec.gross[W])} − ${fmt(rec.open[W])} = ${fmt(net)}`
      + (net > 0 ? `\n   beérkezés = ${item.pack > 1 ? `${item.pack} többszörösére felfelé: ${fmt(rc)} (${rc / item.pack} csomag)` : `${fmt(rc)} (nincs csomagolási egység)`}; rendelés a ${W - item.lead}. héten` : '\n   nincs szükség rendelésre')
      + `\n   záró (következő heti nyitó) = ${fmt(rec.open[W])} + ${fmt(rc)} − ${fmt(rec.gross[W])} = ${fmt(rec.open[W] + rc - rec.gross[W])}`);
  });
  const gLines = (rec, srcs) => Object.keys(rec.gross).map((w) => f(`${w}. hét: ${srcs.map(([name, orders, q]) => (orders[w] ? `${name} rendelése ${fmt(orders[w])} × ${q}` : null)).filter(Boolean).join(' + ')} = ${fmt(rec.gross[w])}`));
  t.walkthrough = [
    step('Az MRP lényege és a darabjegyzék',
      p('Az MRP (anyagszükséglet-tervezés) a késztermék gyártási tervéből visszafelé számolja ki, hogy az egyes alkatrészekből mikor és mennyit kell rendelni. A kulcs: az alkatrész szükséglete a SZÜLŐTÉTEL TERVEZETT RENDELÉSÉBŐL jön (amikor a szülőt elkezdik gyártani, akkor kell hozzá az alkatrész).'),
      ul(P.multi
        ? [`${P.product.name} ← 1 ${P.sub.name.toLowerCase()} + ${P.comps[0].qty} ${P.comps[0].name.toLowerCase()} + ${P.comps[1].qty} ${P.comps[1].name.toLowerCase()}`, `${P.sub.name} ← ${P.comps[1].qtySub} ${P.comps[1].name.toLowerCase()}`]
        : [`${P.product.name} ← ${P.comps.map((c) => `${c.qty} ${c.name.toLowerCase()}`).join(' + ')}`]),
      f('nettó = bruttó − nyitó\nbeérkezés = a nettó a csomagolási egység többszörösére FELFELÉ kerekítve\nrendelés hete = beérkezés hete − átfutási idő\nkövetkező nyitó = nyitó + beérkezés − bruttó')),
    step(`${P.product.name} (késztermék)`, p(`A bruttó szükséglet a vezérprogram: ${Object.entries(P.demand).map(([w, v]) => `${w}. hét: ${fmt(v)} db`).join(', ')}. Kezdő készlet: ${fmt(P.product.stock)} db, átfutás ${P.product.lead} hét.`), weekLines(prodRec, P.product)),
    ...(P.multi ? [step(`${P.sub.name} (részegység, 1 db/termék)`, p('Bruttó szükséglet = a késztermék tervezett rendelése × 1.'), gLines(subRec, [[P.product.name, prodRec.order, 1]]), weekLines(subRec, P.sub))] : []),
    ...P.comps.map((c, i) => step(`${c.name}${P.multi && i === 1 ? ' (közös alkatrész – két helyről kap igényt!)' : ''}`,
      p(P.multi && i === 1 ? `Bruttó szükséglet = késztermék rendelése × ${c.qty} + ${P.sub.name.toLowerCase()} rendelése × ${c.qtySub}. A két forrás eltérő hetekre eshet!` : `Bruttó szükséglet = a késztermék tervezett rendelése × ${c.qty}.`),
      gLines(recs[i], P.multi && i === 1 ? [[P.product.name, prodRec.order, c.qty], [P.sub.name, subRec.order, c.qtySub]] : [[P.product.name, prodRec.order, c.qty]]),
      p(`Kezdő készlet: ${fmt(c.stock)} db, átfutás ${c.lead} hét, csomag ${fmt(c.pack)} db.`),
      weekLines(recs[i], c))),
    step('Tipikus hibák', ul([
      'Az alkatrész bruttó szükségletét a vevői megrendelésből számolni – helyesen a szülőtétel TERVEZETT RENDELÉSÉBŐL kell.',
      'Elfelejteni a kerekítést a csomagolási egység többszörösére, vagy lefelé kerekíteni.',
      'Kétheti átfutásnál csak egy héttel korábbra tenni a rendelést.',
      'A maradék (záró) készletet nem átvinni a következő szükségleti hét nyitókészletébe.',
    ]), tip('A nyitókészlet-sorban a szükségleti heteket és az utána következő hetet (záró készlet) töltsd ki – a javítókulcs így pontoz.')),
  ];
  return t;
}
