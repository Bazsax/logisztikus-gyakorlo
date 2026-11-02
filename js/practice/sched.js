// Kiegészítő típus – Rendelésütemezés prioritási szabállyal, késésszámítás (vizsgafeladatsorokból)
import { makeTask, addForm, p, table, note } from './common.js';
import { fmt, roundTo } from '../util.js';

export const meta = { kind: 'sched', title: 'Rendelésütemezés: sorrend, késés, tartalékidő', points: 10, exam: false, order: 10 };

const NAMES = ['Retro', 'Korfu', 'Eglo', 'Summer', 'Donato', 'Lux', 'Nova', 'Prima', 'Orion', 'Vega', 'Aura', 'Terra'];
const RULES = {
  spt: { name: 'Legrövidebb munkaidő', desc: 'a legrövidebb munkaidejű megrendeléssel kezdünk', key: (j) => j.t },
  edd: { name: 'Legkorábbi határidő', desc: 'a legkorábbi határidejű megrendeléssel kezdünk', key: (j) => j.d },
  fifo: { name: 'Elsőként beérkező elsőnek kiszolgálva (FIFO)', desc: 'a beérkezés (táblázat) sorrendjében dolgozunk', key: (j) => j.i },
};

export function generate(r) {
  for (let k = 0; k < 300; k++) {
    const n = 5;
    const names = r.sample(NAMES, n);
    const times = r.sample(Array.from({ length: 16 }, (_, i) => i + 3), n);
    let cum = 0;
    const jobs = names.map((nm, i) => { cum += times[i]; return { i, name: nm, t: times[i], d: 0 }; });
    const total = cum;
    const dues = r.sample(Array.from({ length: total }, (_, i) => i + 4), n);
    jobs.forEach((j, i) => { j.d = dues[i]; });
    const rule = r.pick(['spt', 'spt', 'edd', 'fifo']);
    const keys = jobs.map(RULES[rule].key);
    if (new Set(keys).size !== n) continue;
    const res = schedule(jobs, rule);
    const late = res.rows.filter((x) => x.late > 0).length;
    if (late >= 1 && late <= 4) return build({ jobs, rule });
  }
  return build({ rule: 'spt', jobs: [['Retro', 4, 6], ['Korfu', 6, 10], ['Eglo', 8, 11], ['Summer', 15, 29], ['Donato', 18, 40]].map(([name, t, d], i) => ({ i, name, t, d })) });
}

function schedule(jobs, rule) {
  const order = jobs.slice().sort((a, b) => RULES[rule].key(a) - RULES[rule].key(b));
  let time = 0;
  const rows = order.map((j) => {
    const start = time; const end = time + j.t; time = end;
    return { ...j, start, end, handover: Math.max(end, j.d), late: Math.max(0, end - j.d), slack: Math.max(0, j.d - end) };
  });
  return { rows };
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const R = RULES[P.rule];
  const { rows } = schedule(P.jobs, P.rule);
  const n = rows.length;
  const totLate = rows.reduce((s, x) => s + x.late, 0);
  const totSlack = rows.reduce((s, x) => s + x.slack, 0);
  const nLate = rows.filter((x) => x.late > 0).length;
  const avgAll = totLate / n; const avgLate = nLate ? totLate / nLate : 0;
  const pLate = (nLate / n) * 100;
  t.statement = [
    p('Egy gyártó cég megrendelési adatait az alábbi táblázat mutatja (a beérkezés sorrendjében). Az üzemben egyszerre csak egy munkával foglalkoznak, a megrendelések között nincs várakozás, a kezdési idő 0 óra.'),
    table(['Megrendelés', 'Munkaidő (óra)', 'Határidő (óra)'], P.jobs.map((j) => [j.name, j.t, j.d])),
    p('Ha a megrendelés a határidő előtt vagy pontosan határidőre elkészül, határidőben adják át; ha később, akkor az elkészülés időpontjában.'),
    p(`Határozza meg a „${R.name}” prioritási szabály szerint a feldolgozási sorrendet és az ütemezési adatokat, majd a késési mutatókat!`),
  ];
  const names = P.jobs.map((j) => j.name);
  addForm(t, 's', 'Ütemezés', ['Sorrend', 'Megrendelés', 'Kezdés', 'Befejezés', 'Átadás', 'Késés (óra)'], rows.map((x, k) => ({
    label: `${k + 1}.`, calc: false, mode: 'each', pts: 1,
    fields: [{ type: 'select', options: names, expect: x.name }, { expect: x.start }, { expect: x.end }, { expect: x.handover }, { expect: x.late }],
  })));
  const pctAcc = (v) => [roundTo(v, 1), Math.round(v)];
  addForm(t, 'k', 'Mutatók', ['Mutató', 'Eredmény'], [
    { label: 'Összes késés (óra)', field: { expect: totLate }, pts: 1 },
    { label: 'Összes tartalékidő (a határidő előtt elkészült munkák, óra)', field: { expect: totSlack }, pts: 1 },
    { label: 'Egy megrendelésre jutó átlagos késés (óra)', field: { expect: roundTo(avgAll, 1), accept: [Math.round(avgAll)], dec: 1, tol: 0.051 }, pts: 1 },
    { label: 'Egy KÉSVE elvégzett megrendelésre jutó átlagos késés (óra)', field: { expect: roundTo(avgLate, 1), accept: [Math.round(avgLate)], dec: 1, tol: 0.051 }, pts: 1 },
    { label: 'Késések aránya (%)', field: { expect: Math.round(pLate), accept: pctAcc(pLate), unit: '%' }, pts: 0.5 },
    { label: 'Határidőre végzett megrendelések aránya (%)', field: { expect: Math.round(100 - pLate), accept: pctAcc(100 - pLate), unit: '%' }, pts: 0.5 },
  ]);
  t.hints = [
    `Szabály: ${R.desc}. Először állítsd sorba a megrendeléseket, aztán haladj végig az időn: minden munka ott kezdődik, ahol az előző befejeződött.`,
    'Befejezés = kezdés + munkaidő. Átadás = a befejezés és a határidő közül a későbbi. Késés = befejezés − határidő, ha pozitív; ha a munka korábban kész, a különbség tartalékidő.',
    `Az első munka: ${rows[0].name} (0 → ${rows[0].end} óra). Átlagos késés = összes késés ÷ összes megrendelés (${n}); a késve végzettekre: összes késés ÷ késve végzett megrendelések száma.`,
  ];
  t.solution = [
    table(['Sorrend', 'Megrendelés', 'Munkaidő', 'Kezdés', 'Befejezés', 'Határidő', 'Átadás', 'Késés'], rows.map((x, k) => [k + 1, x.name, x.t, x.start, x.end, x.d, x.handover, x.late || 0])),
    p(`Összes késés: ${rows.map((x) => x.late).join(' + ')} = ${totLate} óra; tartalékidő: ${totSlack} óra.`),
    p(`Átlagos késés: ${totLate} ÷ ${n} = ${fmt(avgAll, 2)} óra; késve végzettekre: ${totLate} ÷ ${nLate} = ${fmt(avgLate, 2)} óra.`),
    p(`Késések aránya: ${nLate} ÷ ${n} = ${fmt(pLate, 1)}%; határidőre végzett: ${fmt(100 - pLate, 1)}%.`),
    note('A vizsgák a kerekítést a feladatban adják meg (egész szám vagy egy tizedes) – itt mindkettő elfogadott.'),
  ];
  return t;
}
