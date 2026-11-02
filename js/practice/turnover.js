// 6. feladattípus – Készletek forgási ideje és sebessége kronologikus átlaggal, 3 pont
import { makeTask, addForm, p, table, note , step, f, tip } from './common.js';
import { fmt, roundTo } from '../util.js';

export const meta = { kind: 'turnover', title: 'Forgási idő és sebesség kronologikus átlaggal', points: 3, exam: true, order: 6 };

const DATES = ['Január 1.', 'Április 1.', 'Július 1.', 'Október 1.', 'December 31.'];

export function generate(r, preset) {
  let P;
  if (preset === 'vizsga') P = { vals: [60, 65, 70, 62, 58], sales: 720, days: 360 };
  else if (preset === 'v23') P = { vals: [52, 56, 61, 53, 48], sales: 560, days: 360 };
  else {
    let vals;
    for (let i = 0; i < 200; i++) {
      vals = Array.from({ length: 5 }, () => r.int(30, 120));
      const T = vals[0] / 2 + vals[1] + vals[2] + vals[3] + vals[4] / 2;
      if (Number.isInteger(T) && T % 4 === 0) break;
    }
    const avg = (vals[0] / 2 + vals[1] + vals[2] + vals[3] + vals[4] / 2) / 4;
    const k = r.pick([6, 8, 9, 10, 12, 15, 18, 20, 24]);
    P = { vals, sales: roundTo(avg * k, 2), days: 360 };
  }
  return build(P);
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const [a, b, c, d, e] = P.vals;
  const sum = a / 2 + b + c + d + e / 2;
  const avg = sum / 4;
  const speed = P.sales / avg;
  const time = P.days / speed;
  t.statement = [
    p(`A vizsgált időszak ${P.days} nap, az értékesítés nettó beszerzési áron számított értéke ${fmt(P.sales)} millió Ft. Készletadatok nettó beszerzési áron (millió Ft):`),
    table(['Időpont', 'Készlet (millió Ft)'], DATES.map((dt, i) => [dt, fmt(P.vals[i])])),
    p('Számítsa ki az alábbi adatokat és mutatókat! (Szükség esetén két tizedesre kerekítsen.)'),
  ];
  addForm(t, 'r', null, ['Adat/Mutató', 'Eredmény'], [
    { label: 'Átlagkészlet (millió Ft) – kronologikus átlaggal', field: { expect: roundTo(avg, 2), dec: 2, tol: 0.011, unit: 'millió Ft' }, pts: 1 },
    { label: 'Forgási sebesség (fordulat/év)', field: { expect: roundTo(speed, 2), accept: [roundTo(speed, 1), Math.round(speed)], dec: 2, tol: 0.011, unit: 'fordulat' }, pts: 1 },
    { label: 'Forgási idő (nap)', field: { expect: roundTo(time, 2), accept: [roundTo(time, 1), Math.round(time), roundTo(P.days / Math.round(speed), 1)], dec: 2, tol: 0.06, unit: 'nap' }, pts: 1 },
  ]);
  t.hints = [
    'Kronologikus átlag: az első és az utolsó adatot csak FELE súllyal vesszük figyelembe, az osztó pedig az adatok száma mínusz egy.',
    'Forgási sebesség = értékesítés ÷ átlagkészlet (fordulat). Forgási idő = időszak napjai ÷ forgási sebesség (vagy átlagkészlet × napok ÷ értékesítés).',
    `Átlagkészlet = (${fmt(a)}/2 + ${fmt(b)} + ${fmt(c)} + ${fmt(d)} + ${fmt(e)}/2) ÷ 4.`,
  ];
  t.solution = [
    p(`Átlagkészlet = (${fmt(a / 2)} + ${fmt(b)} + ${fmt(c)} + ${fmt(d)} + ${fmt(e / 2)}) ÷ 4 = ${fmt(sum)} ÷ 4 = ${fmt(roundTo(avg, 2))} millió Ft`),
    p(`Forgási sebesség = ${fmt(P.sales)} ÷ ${fmt(roundTo(avg, 2))} = ${fmt(roundTo(speed, 2))} fordulat/év`),
    p(`Forgási idő = ${P.days} ÷ ${fmt(roundTo(speed, 2))} = ${fmt(roundTo(time, 2))} nap`),
    note('Kronologikus átlagnál az első és az utolsó adat fele súllyal szerepel, az osztó n − 1.'),
  ];

  t.walkthrough = [
    step('Miért kronologikus átlag?',
      p('A készletet időpontokban mérték (negyedévenként). Az első és az utolsó adat az időszak szélein van, ezért csak FELE súllyal számít; a közbülső adatok teljes súllyal. Az osztó az adatok száma mínusz egy (itt 5 − 1 = 4 negyedév).'),
      f('átlagkészlet = (x1/2 + x2 + x3 + x4 + x5/2) ÷ (n − 1)')),
    step('Az átlagkészlet kiszámítása',
      f(`= (${fmt(a)}/2 + ${fmt(b)} + ${fmt(c)} + ${fmt(d)} + ${fmt(e)}/2) ÷ 4\n= (${fmt(a / 2)} + ${fmt(b)} + ${fmt(c)} + ${fmt(d)} + ${fmt(e / 2)}) ÷ 4\n= ${fmt(sum)} ÷ 4 = ${fmt(roundTo(avg, 2))} millió Ft`)),
    step('Forgási sebesség (hányszor fordul meg a készlet egy év alatt)',
      f(`forgási sebesség = értékesítés ÷ átlagkészlet = ${fmt(P.sales)} ÷ ${fmt(roundTo(avg, 2))} = ${fmt(roundTo(speed, 2))} fordulat/év`)),
    step('Forgási idő (hány nap alatt fordul meg egyszer)',
      f(`forgási idő = napok ÷ forgási sebesség = ${P.days} ÷ ${fmt(roundTo(speed, 2))} = ${fmt(roundTo(time, 2))} nap\n(másképp: átlagkészlet × napok ÷ értékesítés = ${fmt(roundTo(avg, 2))} × ${P.days} ÷ ${fmt(P.sales)})`),
      p('Értelmezés: minél nagyobb a forgási sebesség és minél kisebb a forgási idő, annál kevesebb pénz van a készletben lekötve.'),
      tip('Ha a feladat egészre kerekítést kér, az egészre kerekített értékekkel is helyes – az app mindkettőt elfogadja.')),
  ];
  return t;
}
