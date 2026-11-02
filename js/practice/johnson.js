// 5. feladattípus – Gyártási megrendelések ütemezése Johnson-szabállyal, 3 pont
import { makeTask, addForm, p, table, note , step, f, tip } from './common.js';
import { fmt } from '../util.js';

export const meta = { kind: 'johnson', title: 'Ütemezés Johnson-szabály alapján', points: 3, exam: true, order: 5 };

const NAMES = ['Vero', 'Axon', 'Zeno', 'Oryx', 'Nexa', 'Koru', 'Lumo', 'Pixa', 'Rava', 'Tero', 'Mira', 'Sola'];
const STAGES = [
  ['Gamer szék', 'Váz készítése', 'Ülő- és hátrész legyártása'],
  ['bútorlap', 'Szabás', 'Élzárás'],
  ['alkatrész', 'Esztergálás', 'Fúrás'],
  ['könyv', 'Nyomtatás', 'Kötészet'],
];

export function generate(r, preset) {
  let P;
  if (preset === 'v23') {
    P = { what: 'kisbútor', m1: 'Festés', m2: 'Lakkozás', jobs: [['A', 2, 5], ['B', 6, 4], ['C', 4, 6], ['D', 3, 1], ['E', 1, 8]] };
  } else if (preset === 'vizsga') {
    P = { what: 'Gamer szék', m1: 'Váz készítése', m2: 'Ülő- és hátrész legyártása', jobs: [['Vero', 4, 7], ['Axon', 8, 5], ['Zeno', 5, 9], ['Oryx', 2, 3], ['Nexa', 6, 2], ['Koru', 1, 8]] };
  } else {
    const n = r.pick([5, 6, 6]);
    const names = r.sample(NAMES, n);
    const vals = r.sample(Array.from({ length: 14 }, (_, i) => i + 1), 2 * n);
    const [what, m1, m2] = r.pick(STAGES);
    P = { what, m1, m2, jobs: names.map((nm, i) => [nm, vals[2 * i], vals[2 * i + 1]]) };
  }
  return build(P);
}

export function johnson(jobs) {
  const front = []; const back = [];
  const left = jobs.map((j) => ({ name: j[0], a: j[1], b: j[2] }));
  const steps = [];
  while (left.length) {
    let best = null;
    for (const j of left) {
      for (const [m, v] of [[1, j.a], [2, j.b]]) {
        if (!best || v < best.v || (v === best.v && m < best.m)) best = { j, m, v };
      }
    }
    left.splice(left.indexOf(best.j), 1);
    if (best.m === 1) front.push(best.j.name); else back.unshift(best.j.name);
    steps.push(best);
  }
  return { seq: [...front, ...back], steps };
}

export function makespan(jobs, seq) {
  const map = Object.fromEntries(jobs.map((j) => [j[0], j]));
  let t1 = 0; let t2 = 0;
  const rows = [];
  for (const nm of seq) {
    const [, a, b] = map[nm];
    const s1 = t1; t1 += a;
    const s2 = Math.max(t1, t2); t2 = s2 + b;
    rows.push([nm, `${s1}–${t1}`, `${s2}–${t2}`]);
  }
  return { total: t2, rows };
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const { seq, steps } = johnson(P.jobs);
  const ms = makespan(P.jobs, seq);
  const names = P.jobs.map((j) => j[0]);
  t.statement = [
    p(`Egy üzemben a(z) ${P.what} előállítási folyamata kötött sorrendű: a(z) „${P.m1}” műveletet követi a(z) „${P.m2}” művelet. Az üzemben ${P.jobs.length}-féle termék készül. A megmunkálási időszükséglet (percben):`),
    table(['Termék', P.m1, P.m2], P.jobs.map((j) => [j[0], j[1], j[2]])),
    p('Milyen sorrendben végezzék a tevékenységeket, hogy a lehető legrövidebb idő alatt elkészüljenek mindegyik termékkel?'),
  ];
  addForm(t, 'seq', null, ['Sorszám', 'Termék'], seq.map((nm, i) => ({
    label: `${i + 1}.`, field: { type: 'select', options: names, expect: nm }, pts: 3 / seq.length, calc: false, ptsLabel: fmt(Math.round(300 / seq.length) / 100) + ' pont',
  })));
  addForm(t, 'ms', 'Kiegészítő (nem pontozott)', ['Adat', 'Eredmény'], [
    { label: 'Teljes átfutási idő (perc)', field: { expect: ms.total, unit: 'perc' }, pts: 0, calc: false, ptsLabel: '–' },
  ]);
  const first = steps[0];
  t.hints = [
    'Johnson-szabály két gépre: keresd meg a legkisebb időt az összes közül. Ha az első gépen van, a termék a sor ELEJÉRE kerül, ha a második gépen, a sor VÉGÉRE. Ezután a terméket kihúzod, és ismétled.',
    'Az elejére kerülők balról jobbra töltik a sort, a végére kerülők jobbról balra. Egyenlő idők esetén az első gépen lévőt vedd előbb.',
    `Az első lépés: a legkisebb idő ${first.v} perc (${first.j.name}, ${first.m}. gép) → ${first.j.name} a sor ${first.m === 1 ? 'elejére' : 'végére'} kerül.`,
  ];
  t.solution = [
    p('Lépések (a legkisebb időadatok sorrendjében): ' + steps.map((s) => `${s.j.name} – ${s.v} perc, ${s.m}. gép → ${s.m === 1 ? 'elölről' : 'hátulról'}`).join('; ') + '.'),
    p(`Sorrend: ${seq.join(' → ')}`),
    table(['Termék', `${P.m1} (kezd–vég)`, `${P.m2} (kezd–vég)`], ms.rows),
    note(`Teljes átfutási idő: ${fmt(ms.total)} perc.`),
  ];

  const front = []; const back = []; const done = new Set();
  const jl = steps.map((s) => {
    const left = P.jobs.filter((j) => !done.has(j[0]));
    const minTxt = left.map((j) => `${j[0]}: ${j[1]} / ${j[2]}`).join(', ');
    done.add(s.j.name);
    if (s.m === 1) front.push(s.j.name); else back.unshift(s.j.name);
    const slots = [...front, ...Array(P.jobs.length - front.length - back.length).fill('_'), ...back];
    return f(`Maradék (1. gép / 2. gép): ${minTxt}\n→ legkisebb: ${s.v} perc (${s.j.name}, ${s.m}. gép) → ${s.m === 1 ? 'ELŐRE, az első szabad helyre' : 'HÁTRA, az utolsó szabad helyre'}\n   sorrend: ${slots.join(' – ')}`);
  });
  t.walkthrough = [
    step('A Johnson-szabály két gépre',
      p('Ha minden terméknek ugyanabban a sorrendben kell átmennie két gépen, a Johnson-szabály megadja azt a sorrendet, amelynél a legrövidebb a teljes átfutási idő.'),
      f('1. Keresd meg az ÖSSZES még be nem sorolt idő közül a legkisebbet.\n2. Ha az az 1. gépen van → a termék a sor ELEJÉRE (első szabad hely).\n   Ha a 2. gépen van → a sor VÉGÉRE (utolsó szabad hely).\n3. Húzd ki a terméket, és ismételd, amíg mind be nem került.'),
      p('Miért? Az elején a rövid első műveletű termékek gyorsan „etetik” a második gépet, a végén pedig a rövid második műveletű termékek miatt nem kell sokat várni a befejezésre.'),
      tip('Egyenlő legkisebb időknél az első gépen lévőt vesszük előbb (a javítókulcsok is így járnak el).')),
    step('A besorolás lépésről lépésre', jl),
    step('Eredmény és ellenőrzés Gantt-táblázattal',
      p(`Sorrend: ${seq.join(' → ')}`),
      p('A második gép egy terméket csak akkor kezdhet, ha az első gép már végzett vele ÉS a második gép is szabad: kezdés = max(1. gép vége, 2. gép előző vége).'),
      table(['Termék', `${P.m1} (kezd–vég)`, `${P.m2} (kezd–vég)`], ms.rows),
      f(`Teljes átfutási idő: ${ms.total} perc`)),
  ];
  return t;
}
