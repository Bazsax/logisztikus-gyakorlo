// 7. feladattípus – Termelési jellemzők (kibocsátás, ciklusidő, létszám), 3 pont
import { makeTask, addForm, p, ul, note , step, f, tip } from './common.js';
import { fmt, LETTERS } from '../util.js';

export const meta = { kind: 'production', title: 'Termelési jellemzők: kibocsátás, ciklusidő, létszám', points: 3, exam: true, order: 7 };

export function generate(r, preset) {
  let P;
  if (preset === 'vizsga') P = { what: 'Gamer székek', ops: [4, 8, 12, 5, 2, 1], hours: 8 };
  else if (preset === 'v23') P = { what: 'kisbútorok', ops: [3, 7, 6, 4, 10, 1], hours: 8 };
  else if (preset === 'v23b') P = { what: 'bútorok', ops: [3, 2, 8, 4, 1], hours: 8 };
  else {
    let ops;
    for (let i = 0; i < 100; i++) {
      const n = r.int(4, 7);
      ops = Array.from({ length: n }, () => r.int(1, 12));
      const s = ops.reduce((x, y) => x + y, 0);
      const mx = Math.max(...ops);
      if (s < 58 && ops.filter((o) => o === mx).length === 1) break;
    }
    P = { what: r.pick(['Gamer székek', 'irodai székek', 'kerékpárok', 'konyhaszekrények', 'elektromos rollerek']), ops, hours: r.pick([8, 8, 7.5, 6]) };
  }
  return build(P);
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const sum = P.ops.reduce((x, y) => x + y, 0);
  const cyc = Math.max(...P.ops);
  const mins = P.hours * 60;
  const out = mins / cyc;
  const workers = sum / cyc;
  const perHour = 60 / sum;
  t.statement = [
    p(`A(z) ${P.what} összeszerelésével foglalkozó vállalkozásnál az összeállítás folyamata ${P.ops.length} egymást követő feladatból áll. Az egyes feladatok műveleti ideje:`),
    ul(P.ops.map((o, i) => `${LETTERS[i]}. feladat: ${o} perc`)),
    p('Kerekítési pontosság: egész (matematikai és logikai kerekítés is elfogadott). A végeredmény mellékszámítás nélkül nem értékelhető.'),
  ];
  const both = (x) => [Math.floor(x + 1e-9), Math.round(x), Math.ceil(x - 1e-9)];
  const fld = (main, acc) => ({ expect: main, accept: acc.filter((v) => v !== main) });
  addForm(t, 'r', null, ['Adat/mutató', 'Eredmény'], [
    { label: `Maximális kibocsátás mennyisége egy ${fmt(P.hours)} órás műszak alatt (db/műszak)`, field: { ...fld(Math.floor(out + 1e-9), both(out).slice(0, 2)), unit: 'db' }, pts: 1 },
    { label: 'Szükséges dolgozói létszám a maximális kibocsátás teljesítéséhez (fő)', field: { expect: Math.ceil(workers - 1e-9), unit: 'fő' }, pts: 1 },
    { label: 'Kibocsátás óránként, ha a teljes munkafolyamatot 1 fő dolgozó végzi (db/óra)', field: { ...fld(Math.floor(perHour + 1e-9), both(perHour).slice(0, 2)), unit: 'db' }, pts: 1 },
  ]);
  addForm(t, 'x', 'Kiegészítő kérdések (nem pontozott, a tanfolyami feladatsorokból)', ['Adat/mutató', 'Eredmény'], [
    { label: 'Összes műveleti idő = a termék gyártási átfutási ideje (perc)', field: { expect: sum, unit: 'perc' }, pts: 0, calc: false, ptsLabel: '–' },
    { label: 'Ciklusidő (perc)', field: { expect: cyc, unit: 'perc' }, pts: 0, calc: false, ptsLabel: '–' },
    { label: 'Veszteségidő ciklusonként, ha minden műveletet más személy végez (perc)', field: { expect: P.ops.length * cyc - sum, unit: 'perc' }, pts: 0, calc: false, ptsLabel: '–' },
  ]);
  t.hints = [
    'Szalagszerű munkánál az ütemidőt (ciklusidőt) a LEGHOSSZABB művelet határozza meg – ez a szűk keresztmetszet.',
    'Max. kibocsátás = műszak percben ÷ ciklusidő. Létszám = összes műveleti idő ÷ ciklusidő, FELFELÉ kerekítve (fél ember nincs). Egy dolgozónál egy termék a teljes műveleti időösszegig tart.',
    `Ciklusidő = ${cyc} perc; a műszak ${fmt(mins)} perc; az összes műveleti idő ${P.ops.join(' + ')} = ${sum} perc.`,
  ];
  t.solution = [
    p(`Ciklusidő = a leghosszabb művelet = ${cyc} perc → ${fmt(mins)} ÷ ${cyc} = ${fmt(out, 2)} → ${Math.floor(out + 1e-9)} db/műszak`),
    p(`Létszám = ${sum} ÷ ${cyc} = ${fmt(workers, 2)} → felfelé kerekítve ${Math.ceil(workers - 1e-9)} fő`),
    p(`1 fő esetén: 60 ÷ ${sum} = ${fmt(perHour, 3)} → ${Math.floor(perHour + 1e-9)} db/óra (logikai kerekítéssel lefelé; matematikai kerekítés is elfogadott)`),
    p(`Veszteségidő: ${P.ops.length} művelet × ${cyc} perc − ${sum} perc = ${P.ops.length * cyc - sum} perc ciklusonként (minden dolgozó a leglassabb művelet ütemére vár).`),
    note('Késztermékről van szó, ezért a logikai (lefelé) kerekítés a védhetőbb, de a vizsgán mindkettő elfogadott.'),
  ];

  const maxIdx = P.ops.indexOf(cyc);
  t.walkthrough = [
    step('Ciklusidő: a leglassabb művelet',
      p('Szalagszerű gyártásnál minden dolgozó a saját műveletét végzi, és a termék továbbhalad. A szalag csak olyan gyorsan haladhat, mint a leglassabb művelet – ez a szűk keresztmetszet, ennek ideje a ciklusidő (ütemidő).'),
      f(`műveleti idők: ${P.ops.map((o, i) => `${LETTERS[i]}=${o}`).join(', ')} perc\nciklusidő = max = ${cyc} perc (${LETTERS[maxIdx]} feladat)`)),
    step('Maximális kibocsátás egy műszak alatt',
      p('Minden ciklusidő végén elkészül egy termék.'),
      f(`műszak = ${fmt(P.hours)} × 60 = ${fmt(mins)} perc\nkibocsátás = ${fmt(mins)} ÷ ${cyc} = ${fmt(out, 2)} → ${Math.floor(out + 1e-9)} db`),
      tip('Késztermékből csak egész darab készülhet el, ezért lefelé kerekítünk (a vizsgán a matematikai kerekítés is elfogadott).')),
    step('Szükséges létszám',
      p('Egy termékhez összesen ennyi munkaidő kell (átfutási idő):'),
      f(`összes műveleti idő = ${P.ops.join(' + ')} = ${sum} perc\nlétszám = ${sum} ÷ ${cyc} = ${fmt(workers, 2)} → ${Math.ceil(workers - 1e-9)} fő`),
      tip('A létszámot mindig FELFELÉ kerekítjük – fél ember nincs, és kevesebb dolgozóval nem érnénk el a maximális kibocsátást.')),
    step('Kibocsátás, ha egy ember végez mindent',
      p('Ekkor egy termék a teljes műveleti időösszegig tart, utána kezdheti a következőt.'),
      f(`60 ÷ ${sum} = ${fmt(perHour, 3)} → ${Math.floor(perHour + 1e-9)} db/óra (matematikai kerekítéssel ${Math.round(perHour)})`)),
    step('Kiegészítés: veszteségidő',
      p('Ha minden műveletet más dolgozó végez, a gyorsabbak a ciklus végéig várnak. Ciklusonként ennyi idő vész el:'),
      f(`veszteségidő = műveletek száma × ciklusidő − összes műveleti idő\n            = ${P.ops.length} × ${cyc} − ${sum} = ${P.ops.length * cyc - sum} perc`),
      p('Ez a veszteség úgy csökkenthető, ha a műveleteket kiegyenlítjük (a leghosszabbat megosztjuk vagy kettőzzük).')),
  ];
  return t;
}
