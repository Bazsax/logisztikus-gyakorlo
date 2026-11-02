// Kiegészítő típus – Teljes eszközhatékonyság (OEE) (vizsgafeladatsorokból)
import { makeTask, addForm, p, note } from './common.js';
import { fmt, roundTo } from '../util.js';

export const meta = { kind: 'oee', title: 'Teljes eszközhatékonyság (OEE)', points: 8, exam: false, order: 12 };

export function generate(r, preset) {
  const P = preset === 'vizsga'
    ? { days: 300, shifts: 3, stop: 825, cyc: 15, sample: 5000, measured: 83240, plan: 900000, scrap: 14650, product: 'dobozos joghurt' }
    : (() => {
      const days = r.pick([250, 260, 300]); const shifts = r.int(1, 3);
      const hours = days * shifts * 8;
      const cyc = r.pick([10, 12, 15, 20, 30]); const sample = r.pick([1000, 2000, 5000]);
      return {
        days, shifts, stop: Math.round(hours * (0.05 + r.next() * 0.12)), cyc, sample,
        measured: Math.round(sample * cyc / (0.82 + r.next() * 0.16)),
        plan: r.int(20, 120) * 10000, scrap: 0, product: r.pick(['dobozos joghurt', 'palackozott ásványvíz', 'csomagolt keksz', 'műanyag flakon']),
      };
    })();
  if (!P.scrap) P.scrap = Math.round(P.plan * (0.005 + r.next() * 0.04));
  return build(P);
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const total = P.days * P.shifts * 8; const real = total - P.stop;
  const A = roundTo(real / total, 2);
  const exp = P.sample * P.cyc; const Pf = roundTo(exp / P.measured, 2);
  const good = P.plan - P.scrap; const Q = roundTo(good / P.plan, 2);
  const oee = roundTo(A * Pf * Q, 2);
  const oeeExact = roundTo((real / total) * (exp / P.measured) * (good / P.plan), 2);
  t.statement = [
    p(`Egy automata gyártósor ${P.product} előállítását végzi munkanaponta ${P.shifts}×8 órás műszakban. Határozza meg a gyártósor teljes eszközhatékonyságát (OEE)!`),
    p(`a) A tervezett és nem tervezett leállások együttesen évente ${fmt(P.stop)} órát tesznek ki. Évi ${P.days} munkanappal számoljon!`),
    p(`b) A működési ciklusidő ${P.cyc} másodperc. ${fmt(P.sample)} db termék elkészülési idejét megmérve az eredmény ${fmt(P.measured)} másodperc lett.`),
    p(`c) Egy év alatt ${fmt(P.plan)} db gyártását tervezték; minőségi problémák miatt ${fmt(P.scrap)} db-ot selejteztek.`),
    p('Az arányszámokat két tizedesjegyre kerekítse!'),
  ];
  const r2 = (v) => ({ expect: v, dec: 2, tol: 0.0051, showDec: 2, accept: [roundTo(v * 100, 0)] });
  addForm(t, 'o', null, ['Adat', 'Eredmény'], [
    { label: 'Teljes működési idő (óra)', field: { expect: total }, pts: 0.5 },
    { label: 'Tényleges működési idő (óra)', field: { expect: real }, pts: 0.5 },
    { label: 'Rendelkezésre állási mutató', field: r2(A), pts: 1 },
    { label: 'Elvárt teljesítmény (másodperc)', field: { expect: exp }, pts: 1 },
    { label: 'Teljesítménymutató', field: r2(Pf), pts: 1 },
    { label: 'Minőségileg megfelelő termékek (db)', field: { expect: good }, pts: 1 },
    { label: 'Minőségi mutató', field: r2(Q), pts: 1 },
    { label: 'OEE (teljes eszközhatékonyság)', field: { ...r2(oee), accept: [roundTo(oee * 100, 0), oeeExact, roundTo(oeeExact * 100, 0)] }, pts: 2 },
  ]);
  t.hints = [
    'OEE = rendelkezésre állás × teljesítmény × minőség. Mindhárom egy 0 és 1 közötti arányszám.',
    'Rendelkezésre állás = tényleges ÷ teljes működési idő. Teljesítmény = elvárt idő (db × ciklusidő) ÷ mért idő. Minőség = jó termékek ÷ tervezett mennyiség.',
    `Teljes működési idő = ${P.days} × ${P.shifts} × 8 = ${fmt(total)} óra.`,
  ];
  t.solution = [
    p(`Rendelkezésre állás: (${fmt(total)} − ${fmt(P.stop)}) ÷ ${fmt(total)} = ${fmt(real)} ÷ ${fmt(total)} = ${fmt(A, 2)}`),
    p(`Teljesítmény: ${fmt(P.sample)} × ${P.cyc} = ${fmt(exp)} s → ${fmt(exp)} ÷ ${fmt(P.measured)} = ${fmt(Pf, 2)}`),
    p(`Minőség: (${fmt(P.plan)} − ${fmt(P.scrap)}) ÷ ${fmt(P.plan)} = ${fmt(Q, 2)}`),
    p(`OEE = ${fmt(A, 2)} × ${fmt(Pf, 2)} × ${fmt(Q, 2)} = ${fmt(oee, 2)} (${fmt(Math.round(oee * 100))}%)`),
    note('A vizsgamegoldás a kerekített részeredményeket szorozza össze; a kerekítés nélküli szorzat is elfogadott.'),
  ];
  return t;
}
