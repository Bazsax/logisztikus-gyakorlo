// 2. feladattípus – Beszállítói értékelés súlyozott pontrendszerrel, 6 pont
import { makeTask, addForm, p, ul, note, step, f, tip } from './common.js';
import { fmt, roundTo } from '../util.js';

export const meta = { kind: 'supplier', title: 'Beszállítói értékelés súlyozott pontrendszerrel', points: 6, exam: true, order: 2 };

const NAMES = [['Alfa', 'Béta'], ['Gamma', 'Delta'], ['Omega', 'Szigma'], ['Kappa', 'Lambda']];
const WEIGHTS = [[35, 30, 25, 10], [40, 30, 20, 10], [30, 30, 25, 15], [30, 25, 30, 15], [25, 35, 30, 10]];

export function generate(r, preset) {
  let P;
  if (preset === 'v23') {
    P = {
      names: ['„A”', '„B”'], weights: [30, 25, 35, 10],
      s: [
        { total: 54, qty: 53, quality: 52, time: 50, price: 600, phr: { qty: 'pos', quality: 'pos', time: 'neg' } },
        { total: 46, qty: 43, quality: 44, time: 45, price: 580, phr: { qty: 'pos', quality: 'neg', time: 'pos' } },
      ],
      keyAlt: [null, 96.5],
      keyNote: 'A 23-as feladatlap megoldókulcsa a „B” szállítóra 96,5%-ot ad, mert az időbeni pontosságnál 0,978 helyett 0,987-tel szorzott (35 × 0,987 = 34,545). A helyes érték 35 × 0,978 = 34,230 → 96,2%. Mindkettőt elfogadjuk.',
    };
  } else if (preset === 'vizsga') {
    P = {
      names: ['Alfa', 'Béta'], weights: [35, 30, 25, 10],
      s: [
        { total: 60, qty: 58, quality: 57, time: 54, price: 850, phr: { qty: 'pos', quality: 'pos', time: 'neg' } },
        { total: 50, qty: 44, quality: 47, time: 48, price: 820, phr: { qty: 'pos', quality: 'neg', time: 'pos' } },
      ],
    };
  } else {
    const mk = () => {
      const total = r.int(8, 16) * 5;
      return {
        total, qty: total - r.int(0, 6), quality: total - r.int(0, 6), time: total - r.int(0, 7),
        price: r.int(14, 26) * 50,
        phr: { qty: r.pick(['pos', 'neg']), quality: r.pick(['pos', 'neg']), time: r.pick(['pos', 'neg']) },
      };
    };
    P = { names: r.pick(NAMES), weights: r.pick(WEIGHTS), s: [mk(), mk()] };
    if (P.s[0].price === P.s[1].price) P.s[1].price += 30;
  }
  return build(P);
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const [wQ, wM, wT, wP] = P.weights;
  const minPrice = Math.min(P.s[0].price, P.s[1].price);
  const co = P.s.map((s) => ({
    qty: roundTo(s.qty / s.total, 3), quality: roundTo(s.quality / s.total, 3), time: roundTo(s.time / s.total, 3), price: roundTo(minPrice / s.price, 3),
  }));
  const pct = co.map((c) => roundTo((wQ * c.qty + wM * c.quality + wT * c.time + wP * c.price) / (wQ + wM + wT + wP) * 100, 1));

  const desc = (s) => ul([
    s.phr.qty === 'pos' ? `${s.qty} volt mennyiségileg pontos,` : `${s.total - s.qty} esetben nem volt mennyiségileg pontos,`,
    s.phr.time === 'pos' ? `${s.time} érkezett időben, pontosan,` : `${s.total - s.time} nem érkezett meg határidőre,`,
    s.phr.quality === 'pos' ? `${s.quality} minőségileg megfelelő volt,` : `${s.total - s.quality} esetben nem felelt meg a minőség,`,
    `egységár: ${fmt(s.price)} Ft/db.`,
  ]);
  t.statement = [
    p('Az Ön feladata a beszállítók értékelése. A következő információk állnak rendelkezésre:'),
    p(`„${P.names[0]}” beszállító – összesen ${P.s[0].total} szállítás:`), desc(P.s[0]),
    p(`„${P.names[1]}” beszállító – összesen ${P.s[1].total} szállítás:`), desc(P.s[1]),
    p(`A vállalat súlyozott pontrendszerrel értékeli a szállítókat. A súlyok: mennyiségi pontosság ${wQ} pont, minőségi megfelelés ${wM} pont, időbeni pontosság ${wT} pont, egységár ${wP} pont.`),
    p('Számításait együtthatós formában három tizedes, százalékos adatoknál egy tizedesjegy pontossággal végezze! Számítsa ki a beszállítók átlagos kiszolgálási színvonalát!'),
  ];
  const cf = (v) => ({ expect: v, dec: 3, tol: 0.0011, showDec: 3 });
  addForm(t, 'co', 'Kiszolgálási színvonal (együtthatós formában)', ['Szempont (súly)', P.names[0], P.names[1]], [
    { label: `Mennyiségi pontosság (${wQ})`, fields: [cf(co[0].qty), cf(co[1].qty)], pts: 1, mode: 'each', calc: false, ptsLabel: '2×0,5' },
    { label: `Minőségi megfelelés (${wM})`, fields: [cf(co[0].quality), cf(co[1].quality)], pts: 1, mode: 'each', calc: false, ptsLabel: '2×0,5' },
    { label: `Időbeni pontosság (${wT})`, fields: [cf(co[0].time), cf(co[1].time)], pts: 1, mode: 'each', calc: false, ptsLabel: '2×0,5' },
    { label: `Egységár (${wP})`, fields: [cf(co[0].price), cf(co[1].price)], pts: 1, mode: 'each', calc: false, ptsLabel: '2×0,5' },
  ]);
  addForm(t, 'res', 'Átlagos kiszolgálási színvonal (%)', ['Szállító', 'Eredmény (%)'], [
    { label: P.names[0], field: { expect: pct[0], dec: 1, tol: 0.11, showDec: 1, unit: '%' }, pts: 1 },
    { label: P.names[1], field: { expect: pct[1], accept: P.keyAlt?.[1] ? [P.keyAlt[1]] : [], dec: 1, tol: 0.11, showDec: 1, unit: '%' }, pts: 1 },
  ]);

  const s0 = P.s[0];
  t.hints = [
    'Minden szempontnál: megfelelő szállítások száma ÷ összes szállítás (együttható, 3 tizedes). Az egységárnál a legalacsonyabb ár a viszonyítási alap: legkisebb ár ÷ saját ár.',
    'Figyelj a negatív megfogalmazásra: ha „X nem érkezett meg határidőre”, akkor a jó esetek száma = összes − X. A végeredmény: Σ(súly × együttható) ÷ Σsúly × 100, egy tizedesre.',
    `${P.names[0]} mennyiségi pontossága: ${s0.qty} ÷ ${s0.total} = ${fmt(co[0].qty, 3)}. Egységár: ${fmt(minPrice)} ÷ ${fmt(s0.price)} = ${fmt(co[0].price, 3)}.`,
  ];
  t.solution = P.s.map((s, i) => p(`${P.names[i]}: mennyiség ${s.qty}/${s.total} = ${fmt(co[i].qty, 3)}; minőség ${s.quality}/${s.total} = ${fmt(co[i].quality, 3)}; idő ${s.time}/${s.total} = ${fmt(co[i].time, 3)}; ár ${fmt(minPrice)}/${fmt(s.price)} = ${fmt(co[i].price, 3)} → (${wQ}×${fmt(co[i].qty, 3)} + ${wM}×${fmt(co[i].quality, 3)} + ${wT}×${fmt(co[i].time, 3)} + ${wP}×${fmt(co[i].price, 3)}) ÷ 100 = ${fmt(pct[i], 1)}%`));
  if (P.keyNote) t.solution.push(note(P.keyNote));
  t.solution.push(note(`A jobb beszállító: ${pct[0] >= pct[1] ? P.names[0] : P.names[1]} (${fmt(Math.max(...pct), 1)}%).`));

  const conv = (s, key, label) => (s.phr[key] === 'pos' ? `${label}: a szöveg a jókat adja meg → ${s[key]}` : `${label}: a szöveg a ROSSZAKAT adja meg (${s.total - s[key]}) → jók = ${s.total} − ${s.total - s[key]} = ${s[key]}`);
  t.walkthrough = [
    step('A módszer lényege',
      p('Minden szempontnál kiszámoljuk, hogy a szállító a szállítások hányad részében teljesített jól (együttható, 0 és 1 között, 3 tizedesre). Ezután a súlyokkal súlyozott átlagot számolunk, ami százalékban adja a kiszolgálási színvonalat.'),
      f('együttható = megfelelő szállítások ÷ összes szállítás\nár-együttható = legalacsonyabb ár ÷ saját ár\nszínvonal (%) = Σ(súly × együttható) ÷ Σ súly × 100')),
    ...P.s.map((s, i) => step(`„${P.names[i]}” – a megfelelő szállítások száma`,
      p(`Összes szállítás: ${s.total}.`),
      ul([conv(s, 'qty', 'Mennyiségi pontosság'), conv(s, 'time', 'Időbeni pontosság'), conv(s, 'quality', 'Minőségi megfelelés')]),
      tip('Figyelj a tagadó megfogalmazásra („nem érkezett meg határidőre”, „nem felelt meg”) – ilyenkor ki kell vonni az összesből!'))),
    step('Az együtthatók kiszámítása (3 tizedes)',
      ...P.s.map((s, i) => f(`${P.names[i]}: mennyiség ${s.qty}/${s.total} = ${fmt(co[i].qty, 3)} | minőség ${s.quality}/${s.total} = ${fmt(co[i].quality, 3)} | idő ${s.time}/${s.total} = ${fmt(co[i].time, 3)}`)),
      p(`Ár: a legolcsóbb ár (${fmt(minPrice)} Ft) a viszonyítási alap, mert az a legjobb. A legolcsóbb szállító együtthatója 1,000.`),
      ...P.s.map((s, i) => f(`${P.names[i]}: ${fmt(minPrice)} ÷ ${fmt(s.price)} = ${fmt(co[i].price, 3)}`))),
    ...P.s.map((s, i) => step(`„${P.names[i]}” – súlyozott kiszolgálási színvonal`,
      f(`(${wQ}×${fmt(co[i].qty, 3)} + ${wM}×${fmt(co[i].quality, 3)} + ${wT}×${fmt(co[i].time, 3)} + ${wP}×${fmt(co[i].price, 3)}) ÷ ${wQ + wM + wT + wP} × 100\n= (${fmt(wQ * co[i].qty, 3)} + ${fmt(wM * co[i].quality, 3)} + ${fmt(wT * co[i].time, 3)} + ${fmt(wP * co[i].price, 3)}) ÷ 100 × 100\n= ${fmt(pct[i], 1)}%`))),
    step('Döntés és tipikus hibák',
      p(`A magasabb színvonalú szállító: ${pct[0] >= pct[1] ? P.names[0] : P.names[1]}.`),
      ul(['Az együtthatót 3 tizedesre kerekítsd, és már a kerekített értékkel számolj tovább.', 'Az árnál fordított az arány: legkisebb ár ÷ saját ár (nem fordítva!).', 'A súlyok összege itt 100, ezért ÷ 100 × 100 = maga az összeg.'])),
  ];
  return t;
}
