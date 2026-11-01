// 1. feladattípus – Elosztási szükséglettervezés (DRP), 6 pont
import { makeTask, addGrid, ceilTo, p, ul, table, note } from './common.js';
import { fmt } from '../util.js';

const CITIES = ['Budapest', 'Győr', 'Debrecen', 'Szeged', 'Pécs', 'Miskolc', 'Székesfehérvár', 'Nyíregyháza', 'Kecskemét', 'Szombathely'];
const PRODUCTS = ['Gamer szék', 'irodai asztal', 'kerti grill', 'robotporszívó', 'elektromos roller', 'kávéfőző', 'futópad'];
const WEEKS = [4, 5, 6, 7, 8, 9];
const COLS = WEEKS.map((w) => `${w}. hét`);

export const meta = { kind: 'drp', title: 'Elosztási szükséglettervezés (DRP)', points: 6, exam: true, order: 1 };

export function generate(r, preset) {
  let P;
  if (preset === 'vizsga') {
    P = {
      product: 'Gamer szék',
      dcs: [
        { name: 'Budapest', d7: 80, d8: 95, open: 10, lead: 2 },
        { name: 'Győr', d7: 60, d8: 70, open: 15, lead: 1 },
        { name: 'Debrecen', d7: 75, d8: 85, open: 20, lead: 1 },
      ],
      min: 80, step: 40, other: 50, factoryOpen: 12, unit: 15,
    };
  } else {
    const [min, step] = r.pick([[80, 40], [60, 30], [100, 50], [50, 25], [60, 20]]);
    const names = r.sample(CITIES, 3);
    const leads = r.shuffle([2, r.int(1, 2), 1]);
    P = {
      product: r.pick(PRODUCTS),
      dcs: names.map((name, i) => ({ name, d7: r.int(9, 20) * 5, d8: r.int(9, 22) * 5, open: r.int(1, 6) * 5, lead: leads[i] })),
      min, step, other: r.int(2, 6) * 10, factoryOpen: r.int(2, 20), unit: r.pick([10, 12, 15, 20, 25]),
    };
  }
  return build(P);
}

function lot(net, min, step) { return net <= 0 ? 0 : min + Math.max(0, ceilTo(net - min, step)); }

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const idx = (w) => w - 4;
  const dcRes = P.dcs.map((dc) => {
    const open7 = dc.open;
    const net7 = Math.max(0, dc.d7 - open7);
    const rec7 = lot(net7, P.min, P.step);
    const open8 = open7 + rec7 - dc.d7;
    const net8 = Math.max(0, dc.d8 - open8);
    const rec8 = lot(net8, P.min, P.step);
    const open9 = open8 + rec8 - dc.d8;
    const orders = {};
    if (rec7) orders[7 - dc.lead] = rec7;
    if (rec8) orders[8 - dc.lead] = (orders[8 - dc.lead] || 0) + rec8;
    return { dc, open7, net7, rec7, open8, net8, rec8, open9, orders };
  });

  // Késztermékraktár: bruttó kereslet = elosztóközpontok rendelése + egyéb értékesítés (azokon a heteken, amikor van rendelés)
  const orderWeeks = [...new Set(dcRes.flatMap((d) => Object.keys(d.orders).map(Number)))].sort((a, b) => a - b);
  const fw = [];
  let onhand = P.factoryOpen;
  for (const w of orderWeeks) {
    const gross = dcRes.reduce((s, d) => s + (d.orders[w] || 0), 0) + P.other;
    const net = Math.max(0, gross - onhand);
    const rec = net > 0 ? ceilTo(net, P.unit) : 0;
    fw.push({ w, gross, open: onhand, net, rec });
    onhand = onhand + rec - gross;
  }
  const firstW = orderWeeks[0];

  const row = (vals) => { const a = WEEKS.map(() => null); for (const [w, v] of vals) if (v !== null && v !== undefined) a[idx(w)] = v; return a; };

  // Feladatszöveg
  const leadText = P.dcs.map((d) => `${d.name}: ${d.lead} hét`).join(', ');
  t.statement = [
    p(`Egy vállalat ${P.product} értékesítésével foglalkozik. Egy központi késztermékraktárral és három elosztóközponttal (${P.dcs.map((d) => d.name).join(', ')}) rendelkezik.`),
    p('A kereslet és a készlet az egyes elosztóközpontokban:'),
    table(['Adat', ...P.dcs.map((d) => d.name)], [
      ['Kereslet 7. hét (db)', ...P.dcs.map((d) => fmt(d.d7))],
      ['Kereslet 8. hét (db)', ...P.dcs.map((d) => fmt(d.d8))],
      ['Nyitókészlet 7. hét (db)', ...P.dcs.map((d) => fmt(d.open))],
    ]),
    ul([
      `Az elosztóraktárak számára a késztermékraktár a minimális rendelési mennyiséget ${P.min} darabban határozta meg; a rendelési tételnagyság ${P.step} darab (tehát ${P.min}, ${P.min + P.step}, ${P.min + 2 * P.step} … db rendelhető).`,
      `Szállítási idők a késztermékraktárból: ${leadText}.`,
      `A késztermékraktár egyéni vásárlókat is közvetlenül kiszolgál, az egyéb értékesítés hetente átlagosan ${P.other} darab.`,
      `A késztermékraktár ${firstW}. heti nyitókészlete az előrejelzések szerint ${P.factoryOpen} darab lesz.`,
      `A gyár a késztermékraktárba a megrendelést követő 1 hét átfutási idővel teljesít, ${P.unit} darabos egységrakományokban, melyeket nem bont meg.`,
    ]),
    p('A megadott adatok alapján töltse ki az alábbi DRP-táblákat! Mellékszámításait nem szükséges feltüntetnie.'),
  ];

  // Válaszrácsok – a hivatalos pontozás szerint (elosztóközpont: 2×0,1 / 3×0,1 / 2×0,1 / 2×0,1 / 2×0,2)
  dcRes.forEach((d, i) => {
    addGrid(t, `dc${i}`, `${d.dc.name} elosztóközpont`, COLS, [
      { label: 'Bruttó kereslet', values: row([[7, d.dc.d7], [8, d.dc.d8]]), pts: 0.2 },
      { label: 'Nyitókészlet', values: row([[7, d.open7], [8, d.open8], [9, d.open9]]), pts: 0.3 },
      { label: 'Nettó kereslet', values: row([[7, d.net7], [8, d.net8]]), pts: 0.2 },
      { label: 'Tervezett beérkezés', values: row([[7, d.rec7 || null], [8, d.rec8 || null]]), pts: 0.2 },
      { label: 'Tervezett rendelés', values: row(Object.entries(d.orders).map(([w, v]) => [Number(w), v])), pts: 0.4 },
    ]);
  });
  addGrid(t, 'fac', 'Vállalat késztermékraktár', COLS, [
    { label: 'Bruttó kereslet', values: row(fw.map((x) => [x.w, x.gross])), pts: 0.6 },
    { label: 'Nyitókészlet', values: row(fw.map((x) => [x.w, x.open])), pts: 0.3 },
    { label: 'Nettó kereslet', values: row(fw.map((x) => [x.w, x.net])), pts: 0.3 },
    { label: 'Tervezett beérkezés', values: row(fw.map((x) => [x.w, x.rec || null])), pts: 0.3 },
    { label: 'Tervezett rendelés', values: row(fw.map((x) => [x.w - 1, x.rec || null])), pts: 0.6 },
  ]);

  const d0 = dcRes[0];
  t.hints = [
    'Kezdd az elosztóközpontokkal, a késztermékraktár csak utánuk tölthető ki. Soronként: bruttó kereslet → nyitókészlet → nettó kereslet (bruttó − nyitó) → tervezett beérkezés (a rendelhető mennyiségre kerekítve) → tervezett rendelés (a beérkezésnél szállítási idővel korábban).',
    `Rendelhető mennyiség: legalább ${P.min} db, fölötte ${P.step} darabonként. A következő heti nyitókészlet = nyitókészlet + beérkezés − bruttó kereslet. A késztermékraktár bruttó kereslete egy adott héten = az elosztóközpontok azon heti tervezett rendelései + ${P.other} db egyéb értékesítés.`,
    `Példa – ${d0.dc.name}, 7. hét: nettó = ${d0.dc.d7} − ${d0.open7} = ${d0.net7} → beérkezés ${d0.rec7} db, ezt ${d0.dc.lead} héttel korábban, a ${7 - d0.dc.lead}. héten kell megrendelni. A késztermékraktár ${firstW}. heti bruttó kereslete ${fw[0].gross} db; a gyári rendelés ${P.unit} többszöröse.`,
  ];

  t.solution = [
    ...dcRes.map((d) => p(`${d.dc.name}: 7. hét nettó ${d.dc.d7} − ${d.open7} = ${d.net7} → beérkezés ${d.rec7 || '–'}; 8. hét nyitó ${d.open8}, nettó ${d.dc.d8} − ${d.open8} = ${d.net8} → beérkezés ${d.rec8 || '–'}; 9. heti nyitó ${d.open9}. Rendelés ${d.dc.lead} héttel a beérkezés előtt.`)),
    ...fw.map((x) => p(`Késztermékraktár ${x.w}. hét: bruttó = ${dcRes.map((d) => d.orders[x.w] || 0).filter(Boolean).join(' + ') || '0'} + ${P.other} = ${x.gross}; nettó = ${x.gross} − ${x.open} = ${x.net} → ${P.unit} többszörösére kerekítve ${x.rec}; rendelés a ${x.w - 1}. héten.`)),
    note('A hivatalos javítókulcs a késztermékraktárnál csak azokat a heteket tölti ki, amikor az elosztóközpontok rendelnek (soronként 3 cella). Az egyéb értékesítést ezekre a hetekre számítjuk; a további hetek üresen maradnak. A minimális rendelési mennyiség csak az elosztóközpontok felé érvényes.'),
  ];
  return t;
}
