// Kiegészítő típus – Három beszállító értékelése %-os formában, tetszőleges súlyokkal (vizsgafeladatsorokból)
import { makeTask, addForm, p, table, note , step, f, tip } from './common.js';
import { fmt, roundTo } from '../util.js';

export const meta = { kind: 'supplier3', title: 'Három beszállító értékelése (%-os módszer)', points: 9, exam: false, order: 14 };

const CRIT = ['Mennyiségi megfelelés', 'Minőségi megfelelés', 'Határidő-pontosság', 'Ár'];
const NAMES = [['Tannenbaum Kft.', 'Fenyő Bt.', 'Ünnep Kft.'], ['Alfa Zrt.', 'Béta Kft.', 'Gamma Bt.'], ['Nord Kft.', 'Dél Bt.', 'Kelet Zrt.']];

export function generate(r) {
  const names = r.pick(NAMES);
  const weights = r.pick([[60, 40, 30, 20], [40, 30, 30, 60], [35, 25, 30, 10], [30, 25, 35, 10], [50, 30, 20, 20]]);
  const totals = names.map(() => r.int(10, 40));
  const sup = names.map((nm, i) => {
    const T = totals[i];
    return { name: nm, T, ok: [T - r.int(0, 3), T - r.int(0, 3), T - r.int(0, 4)], price: r.int(28, 40) * 10 };
  });
  return build({ weights, sup });
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const W = P.weights.reduce((a, b) => a + b, 0);
  const minP = Math.min(...P.sup.map((s) => s.price));
  const pc = P.sup.map((s) => [...s.ok.map((x) => roundTo(x / s.T * 100, 1)), roundTo(minP / s.price * 100, 1)]);
  const res = pc.map((row) => roundTo(row.reduce((acc, v, k) => acc + v * P.weights[k], 0) / W, 1));
  const best = P.sup[res.indexOf(Math.max(...res))].name;
  t.statement = [
    p('Három beszállító teljesítményét kell értékelnie súlyozott pontrendszerrel. Az adatok:'),
    table(['Szempont (súly)', ...P.sup.map((s) => s.name)], [
      ['Összes szállítás (db)', ...P.sup.map((s) => s.T)],
      ...CRIT.slice(0, 3).map((c, k) => [`${c} – megfelelő szállítás (${P.weights[k]})`, ...P.sup.map((s) => s.ok[k])]),
      [`Egységár, Ft/db (${P.weights[3]})`, ...P.sup.map((s) => s.price)],
    ]),
    p(`Számítsa ki szempontonként a teljesítést százalékban (egy tizedes), majd a súlyozott átlagos kiszolgálási színvonalat (a súlyok összege ${W})! Melyik beszállítót választja?`),
  ];
  const f = (v) => ({ expect: v, dec: 1, tol: 0.11, showDec: 1, unit: '%' });
  addForm(t, 'c', 'Teljesítés szempontonként (%)', ['Szempont', ...P.sup.map((s) => s.name)], CRIT.map((c, k) => ({
    label: `${c} (${P.weights[k]})`, calc: false, mode: 'each', pts: 1.5, fields: P.sup.map((_, i) => f(pc[i][k])),
  })));
  addForm(t, 'r', 'Eredmény', ['Beszállító', 'Kiszolgálási színvonal (%)'], P.sup.map((s, i) => ({ label: s.name, field: f(res[i]), pts: 0.75 })));
  addForm(t, 'w', null, ['', 'Választott beszállító'], [{ label: 'A legjobb beszállító', field: { type: 'select', options: P.sup.map((s) => s.name), expect: best }, pts: 0.75, calc: false }]);
  t.hints = [
    'Szempontonként: megfelelő szállítások ÷ összes szállítás × 100. Árnál: legalacsonyabb ár ÷ saját ár × 100.',
    `Súlyozott átlag = Σ(súly × %) ÷ a súlyok összege (${W}) – itt a súlyok összege nem feltétlenül 100!`,
    `Legalacsonyabb ár: ${minP} Ft/db.`,
  ];
  t.solution = [
    ...P.sup.map((s, i) => p(`${s.name}: ${pc[i].map((v, k) => `${P.weights[k]} × ${fmt(v, 1)}`).join(' + ')} = ${fmt(pc[i].reduce((a, v, k) => a + v * P.weights[k], 0), 1)} ÷ ${W} = ${fmt(res[i], 1)}%`)),
    note(`A legmagasabb kiszolgálási színvonal: ${best}. Ha az értékek közel azonosak, érdemes egyéb szempontokat is mérlegelni.`),
  ];

  t.walkthrough = [
    step('Teljesítés szempontonként (%)', p('Megfelelő szállítás ÷ összes szállítás × 100; árnál a legalacsonyabb ár ÷ saját ár × 100.'),
      ...P.sup.map((s, i) => f(`${s.name}: ${s.ok.map((x, k) => `${CRIT[k]} ${x}/${s.T} = ${fmt(pc[i][k], 1)}%`).join('; ')}; ár ${minP}/${s.price} = ${fmt(pc[i][3], 1)}%`))),
    step('Súlyozott átlag', p(`A súlyok összege ${W}, ezzel osztunk.`), ...P.sup.map((s, i) => f(`${s.name}: (${pc[i].map((v, k) => `${P.weights[k]}×${fmt(v, 1)}`).join(' + ')}) ÷ ${W} = ${fmt(res[i], 1)}%`))),
    step('Döntés', p(`A legjobb: ${best}.`), tip('Ha a súlyok összege nem 100, ne ossz 100-zal – a súlyok összegével kell osztani.')),
  ];
  return t;
}
