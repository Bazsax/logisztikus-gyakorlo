// Kiegészítő típus – Minőségügyi mutatók: hibaráta, átlagos minőségi kategória és együttható (tanfolyami feladatsorokból)
import { makeTask, addForm, p, table, note } from './common.js';
import { fmt, roundTo } from '../util.js';

export const meta = { kind: 'quality', title: 'Minőségügyi mutatók: hibaráta, minőségi kategória és együttható', points: 6, exam: false, order: 15 };

const DEFECTS = ['Minőségi eltérés', 'Késedelmes szállítás', 'Mennyiségi eltérés', 'Sérült áru', 'Hibás csomagolás', 'Hibás számlázás'];

export function generate(r) {
  const counts = DEFECTS.map(() => r.int(1, 35));
  if (new Set(counts).size !== counts.length) counts[0] += 40; // a két leggyakoribb egyértelmű legyen
  return build({
    shipped: r.int(15, 60) * 100 + r.int(0, 99), counts,
    q: [r.int(10, 30) * 1000, r.int(3, 12) * 1000, r.int(5, 20) * 100],
    price: (() => { const p1 = r.int(5, 12) * 1000; return [p1, Math.round(p1 * (0.55 + r.next() * 0.15) / 100) * 100, Math.round(p1 * (0.2 + r.next() * 0.15) / 100) * 100]; })(),
  });
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const tot = P.counts.reduce((a, b) => a + b, 0);
  const rate = roundTo(tot / P.shipped * 100, 2);
  const top = P.counts.map((c, i) => [c, i]).sort((a, b) => b[0] - a[0]).slice(0, 2);
  const topRate = roundTo((top[0][0] + top[1][0]) / P.shipped * 100, 2);
  const Q = P.q.reduce((a, b) => a + b, 0);
  const cat = roundTo((P.q[0] + 2 * P.q[1] + 3 * P.q[2]) / Q, 3);
  const coef = roundTo((P.q[0] * P.price[0] + P.q[1] * P.price[1] + P.q[2] * P.price[2]) / (Q * P.price[0]), 3);
  t.statement = [
    p(`a) Egy negyedévben ${fmt(P.shipped)} tételt szállítottak ki. A minőségi reklamációk:`),
    table(['Hiba', 'Darab'], DEFECTS.map((d, i) => [d, P.counts[i]])),
    p('Határozza meg az összes hibát, a hibarátát (%), valamint a két leggyakoribb hiba együttes hibarátáját (%)! Két tizedesre kerekítsen.'),
    p('b) Egy üzem termelése minőségi osztályonként:'),
    table(['Osztály', 'Mennyiség (db)', 'Egységár (Ft/db)'], [1, 2, 3].map((k) => [`${k}. osztály`, fmt(P.q[k - 1]), fmt(P.price[k - 1])])),
    p('Határozza meg az átlagos minőségi kategóriát és az átlagos minőségi együtthatót (3 tizedes)!'),
  ];
  const d2 = (v) => ({ expect: v, dec: 2, tol: 0.011, showDec: 2, unit: '%' });
  const d3 = (v) => ({ expect: v, dec: 3, tol: 0.0011, showDec: 3 });
  addForm(t, 'q', null, ['Mutató', 'Eredmény'], [
    { label: 'Összes hiba (db)', field: { expect: tot }, pts: 0.5 },
    { label: 'Hibaráta (%)', field: d2(rate), pts: 1 },
    { label: `A két leggyakoribb hiba (${DEFECTS[top[0][1]]}, ${DEFECTS[top[1][1]]}) hibarátája (%)`, field: d2(topRate), pts: 1.5 },
    { label: 'Átlagos minőségi kategória', field: d3(cat), pts: 1.5 },
    { label: 'Átlagos minőségi együttható', field: d3(coef), pts: 1.5 },
  ]);
  t.hints = [
    'Hibaráta = hibák száma ÷ összes kiszállított tétel × 100.',
    'Átlagos minőségi kategória = Σ(mennyiség × osztály sorszáma) ÷ összes mennyiség – annál jobb, minél közelebb van 1-hez (felülről). Átlagos minőségi együttható = Σ(mennyiség × osztályos ár) ÷ (összes mennyiség × 1. osztályú ár) – annál jobb, minél közelebb van 1-hez (alulról).',
    `Összes mennyiség: ${fmt(Q)} db; 1. osztályú ár: ${fmt(P.price[0])} Ft.`,
  ];
  t.solution = [
    p(`Összes hiba: ${P.counts.join(' + ')} = ${tot} db → hibaráta: ${tot} ÷ ${fmt(P.shipped)} × 100 = ${fmt(rate, 2)}%`),
    p(`Két leggyakoribb: ${top[0][0]} + ${top[1][0]} = ${top[0][0] + top[1][0]} db → ${fmt(topRate, 2)}%`),
    p(`Átlagos minőségi kategória: (${fmt(P.q[0])}×1 + ${fmt(P.q[1])}×2 + ${fmt(P.q[2])}×3) ÷ ${fmt(Q)} = ${fmt(cat, 3)}`),
    p(`Átlagos minőségi együttható: (${fmt(P.q[0])}×${fmt(P.price[0])} + ${fmt(P.q[1])}×${fmt(P.price[1])} + ${fmt(P.q[2])}×${fmt(P.price[2])}) ÷ (${fmt(Q)}×${fmt(P.price[0])}) = ${fmt(coef, 3)}`),
    note('A minőségi kategória „felülről”, az együttható „alulról” közelít 1-hez, ha javul a minőség.'),
  ];
  return t;
}
