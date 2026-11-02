// 8. feladattípus – Áruelosztási körjárat sorminimum módszerrel, 3 pont
import { makeTask, addForm, p, table, note } from './common.js';

export const meta = { kind: 'route', title: 'Körjárat optimalizálása (sor-/oszlopminimum)', points: 3, exam: true, order: 8 };

const NODES5 = ['Késztermék raktár', 'A raktár', 'B raktár', 'C raktár', 'D raktár'];
const NODES6 = ['Központi raktár', 'A raktár', 'B raktár', 'C raktár', 'D raktár', 'E raktár'];

export function generate(r, preset) {
  let M; let method = 'sor';
  if (preset === 'vizsga') {
    M = [[0, 3, 4, 12, 6], [15, 0, 5, 1, 12], [4, 5, 0, 2, 7], [1, 6, 2, 0, 5], [18, 12, 15, 18, 0]];
  } else if (preset === 'v23') {
    M = [[0, 3, 5, 11, 9, 6], [15, 0, 7, 2, 9, 4], [4, 6, 0, 6, 7, 13], [7, 5, 2, 0, 1, 19], [13, 12, 15, 18, 0, 6], [8, 9, 11, 10, 3, 0]];
  } else {
    const NODES = NODES5;
    for (let i = 0; i < 500; i++) {
      M = NODES.map((_, a) => NODES.map((__, b) => (a === b ? 0 : r.int(1, 20))));
      method = r.next() < 0.7 ? 'sor' : 'oszlop';
      if (!nearest(method === 'sor' ? M : transpose(M)).tie) break;
    }
  }
  return build({ M, method });
}

const transpose = (M) => M[0].map((_, j) => M.map((row) => row[j]));

export function nearest(M) {
  const n = M.length;
  const visited = [0];
  let cur = 0; let tie = false;
  const legs = [];
  while (visited.length < n) {
    const cands = M[cur].map((d, j) => ({ d, j })).filter((x) => !visited.includes(x.j));
    const min = Math.min(...cands.map((x) => x.d));
    if (cands.filter((x) => x.d === min).length > 1) tie = true;
    const nxt = cands.find((x) => x.d === min);
    legs.push({ from: cur, to: nxt.j, d: min, row: cands });
    visited.push(nxt.j); cur = nxt.j;
  }
  legs.push({ from: cur, to: 0, d: M[cur][0], row: [] });
  return { legs, total: legs.reduce((s, l) => s + l.d, 0), tie };
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const NODES = P.M.length === 6 ? NODES6 : NODES5;
  const col = P.method === 'oszlop';
  const { legs, total } = nearest(col ? transpose(P.M) : P.M);
  t.statement = [
    p('A vállalat késztermékraktárából az elosztóraktárak kiszolgálásához napi túrajáratot kell tervezni. A táblázat a raktárak egymástól való távolságát tartalmazza kilométerben (sor: honnan, oszlop: hová).'),
    table(['Honnan \\ Hová', ...NODES], P.M.map((row, i) => [NODES[i], ...row.map((d, j) => (i === j ? '–' : d))])),
    p(`Határozza meg ${col ? 'oszlopminimum' : 'sorminimum'} módszerrel a túrajárat optimális kiszolgálási sorrendjét úgy, hogy a legkevesebb távolságot tegye meg, és az utolsó elosztóraktár kiszolgálása után visszatérjen a központi raktárba!`),
  ];
  addForm(t, 'leg', null, ['Indulási raktár', 'Érkező raktár', 'Távolság (km)'], legs.map((l) => ({
    label: '', fields: [
      { type: 'select', options: NODES, expect: NODES[l.from] },
      { type: 'select', options: NODES, expect: NODES[l.to] },
      { expect: l.d, unit: 'km' },
    ], pts: (meta.points - 0.5) / legs.length, calc: false,
  })));
  addForm(t, 'tot', null, ['', 'Összesen (km)'], [{ label: 'Összesen', field: { expect: total, unit: 'km' }, pts: 0.5, calc: false }]);
  t.hints = col ? [
    'Oszlopminimum: a késztermékraktár OSZLOPÁBAN keresd a legkisebb értéket – ez az a raktár, ahová először mész. Utána mindig annak a raktárnak az oszlopában keresel, ahol éppen vagy, a még nem érintett raktárak közül.',
    'Ez ugyanaz, mint a sorminimum, csak a táblázatot oszloponként olvasod (a táblázat „tükrözve”). A távolságnak a megtalált értéket írd be.',
    `Első lépés: a késztermékraktár oszlopában a legkisebb érték ${legs[0].d} km → ${NODES[legs[0].to]}.`,
  ] : [
    'Sorminimum: a késztermékraktár SORÁBAN keresd a legkisebb távolságot – oda mész először. Onnan annak a raktárnak a sorában keresed a legkisebbet, de csak a még nem érintett raktárak közül.',
    'A már meglátogatott raktárakat (és a kiinduló raktárt) mindig hagyd ki. Ha mindegyik megvan, az utolsó raktár sorából a késztermékraktárba vezető távolsággal térsz vissza.',
    `Első lépés: a késztermékraktár sorában a legkisebb érték ${legs[0].d} km → ${NODES[legs[0].to]}.`,
  ];
  t.solution = [
    ...legs.map((l) => p(l.row.length
      ? `${NODES[l.from]} ${col ? 'oszlopa' : 'sora'} (még nem érintettek): ${l.row.map((x) => `${NODES[x.j].replace(' raktár', '')}: ${x.d}`).join(' / ')} → legkisebb ${l.d} km → ${NODES[l.to]}`
      : `${NODES[l.from]} → vissza a késztermékraktárba: ${l.d} km`)),
    note(`Összesen: ${total} km. A módszer heurisztika – nem garantálja a globálisan legrövidebb kört, de a feladat ezt a módszert kéri.`),
  ];
  return t;
}
