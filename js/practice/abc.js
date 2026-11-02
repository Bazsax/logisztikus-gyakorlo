// Kiegészítő típus – ABC-analízis készletérték szerint (vizsgafeladatsorokból)
import { makeTask, addForm, p, table, note , step, f, tip } from './common.js';
import { fmt, roundTo } from '../util.js';

export const meta = { kind: 'abc', title: 'ABC-analízis: megoszlások és kumulált százalékok', points: 9, exam: false, order: 11 };

export function generate(r) {
  const n = r.int(12, 15);
  const nA = r.int(2, 3); const nB = r.int(4, 5);
  const vals = [];
  for (let i = 0; i < nA; i++) vals.push(r.int(90, 260) * 100 + r.int(0, 99));
  for (let i = 0; i < nB; i++) vals.push(r.int(35, 90) * 100 + r.int(0, 99));
  for (let i = nA + nB; i < n; i++) vals.push(r.int(8, 35) * 100 + r.int(0, 99));
  vals.sort((a, b) => b - a);
  const items = vals.map((v, i) => ({ code: `${r.int(100, 399)}-${r.int(0, 9)}`, v, g: i < nA ? 'A' : i < nA + nB ? 'B' : 'C' }));
  return build({ items });
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const total = P.items.reduce((s, x) => s + x.v, 0);
  const G = ['A', 'B', 'C'].map((g) => {
    const its = P.items.filter((x) => x.g === g);
    return { g, sum: its.reduce((s, x) => s + x.v, 0), cnt: its.length };
  });
  let cumV = 0; let cumN = 0;
  G.forEach((x) => {
    x.pv = roundTo(x.sum / total * 100, 2); x.pn = roundTo(x.cnt / P.items.length * 100, 2);
    cumV += x.pv; cumN += x.pn; x.cv = roundTo(cumV, 2); x.cn = roundTo(cumN, 2);
  });
  G[2].cv = 100; G[2].cn = 100;
  t.statement = [
    p('Készletelemzőként az alábbi adatok állnak rendelkezésére (a tételek csoportba sorolása adott):'),
    table(['Termékkód', 'Készletérték (Ft)', 'Csoport'], P.items.map((x) => [x.code, fmt(x.v), x.g])),
    p('Határozza meg csoportonként az összesített készletértéket, a készletérték szerinti megoszlást és a kumulált százalékot, a tételek számát, a tételek szerinti megoszlást és annak kumulált százalékát! Kerekítés: egész Ft, egész db, a százalékoknál 2 tizedes.'),
  ];
  const pct = (v) => ({ expect: v, dec: 2, tol: 0.021, showDec: 2, unit: '%' });
  addForm(t, 'g', null, ['Csoport', 'Készletérték (Ft)', 'Megoszlás (%)', 'Kumulált (%)', 'Tételek (db)', 'Tételek (%)', 'Kumulált tétel (%)'], G.map((x) => ({
    label: `„${x.g}” csoport`, calc: false, mode: 'each', pts: 3,
    fields: [{ expect: x.sum, unit: 'Ft' }, pct(x.pv), pct(x.cv), { expect: x.cnt }, pct(x.pn), pct(x.cn)],
  })));
  t.hints = [
    'Összesítsd csoportonként a készletértékeket és számold meg a tételeket. A megoszlás = csoport értéke ÷ összes érték × 100.',
    'A kumulált százalék a megoszlások halmozott összege (A, A+B, A+B+C = 100%). Ugyanígy a tételszámoknál.',
    `Összes készletérték: ${fmt(total)} Ft, összes tétel: ${P.items.length} db.`,
  ];
  t.solution = [
    table(['Csoport', 'Érték (Ft)', 'Megoszlás %', 'Kumulált %', 'Tétel (db)', 'Tétel %', 'Kumulált tétel %'], G.map((x) => [x.g, fmt(x.sum), fmt(x.pv, 2), fmt(x.cv, 2), x.cnt, fmt(x.pn, 2), fmt(x.cn, 2)])),
    note('Jellemző eredmény: kevés „A” tétel adja a készletérték nagy részét (Pareto-elv). A vizsgán ezután a Pareto-diagramot is meg kell rajzolni a két kumulált sor alapján.'),
  ];

  t.walkthrough = [
    step('Csoportonkénti összegzés', ...G.map((x) => f(`${x.g}: ${P.items.filter((it) => it.g === x.g).map((it) => fmt(it.v)).join(' + ')} = ${fmt(x.sum)} Ft, ${x.cnt} tétel`)), f(`összesen: ${fmt(total)} Ft, ${P.items.length} tétel`)),
    step('Megoszlás érték szerint és kumulálva', f(G.map((x) => `${x.g}: ${fmt(x.sum)} ÷ ${fmt(total)} × 100 = ${fmt(x.pv, 2)}%  → kumulált ${fmt(x.cv, 2)}%`).join('\n')), tip('A kumulált százalék a megoszlások halmozott összege; a C-nél 100%-ra jön ki.')),
    step('Megoszlás tételszám szerint és kumulálva', f(G.map((x) => `${x.g}: ${x.cnt} ÷ ${P.items.length} × 100 = ${fmt(x.pn, 2)}%  → kumulált ${fmt(x.cn, 2)}%`).join('\n'))),
    step('Értelmezés', p(`Az „A” csoport a tételek ${fmt(G[0].pn, 2)}%-a, de a készletérték ${fmt(G[0].pv, 2)}%-a – ezekre kell a legnagyobb figyelmet fordítani (Pareto-elv). A Pareto-diagram vízszintes tengelyén a tételek, függőlegesen az érték kumulált %-a szerepel.`)),
  ];
  return t;
}
