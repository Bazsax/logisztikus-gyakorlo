// Kiegészítő típus – Készletszintek és összköltség EOQ mellett (vizsgafeladatsorokból)
import { makeTask, addForm, p, note , step, f, tip } from './common.js';
import { fmt } from '../util.js';

export const meta = { kind: 'stock', title: 'Készletszintek, rendelésszám és összköltség (EOQ)', points: 10, exam: false, order: 13 };

export function generate(r) {
  for (let i = 0; i < 800; i++) {
    const Q = r.pick([200, 250, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000]);
    const S = r.pick([400, 500, 600, 800, 1000, 1200, 1500, 2000, 3000, 6000]);
    const Ky = r.pick([12, 18, 24, 36, 48, 60, 72, 96, 120, 144, 216, 240]);
    const D = (Q * Q * Ky) / (2 * S);
    const n = r.pick([250, 300, 360]);
    if (!Number.isInteger(D) || D < 2000 || D > 2000000 || D % n !== 0) continue;
    return build({ D, S, Ky, Km: Ky / 12, n, price: r.int(5, 120) * 10, L: r.int(2, 10), SS: r.int(2, 40) * 50, monthly: r.next() < 0.6 });
  }
  return build({ D: 1200000, S: 500, Ky: 24, Km: 2, n: 300, price: 350, L: 8, SS: 2000, monthly: true });
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const Qx = Math.sqrt(2 * P.S * P.D / P.Ky); const Q = Math.round(Qx);
  const daily = P.D / P.n; const FK = Math.round(daily) * P.L; const JK = P.SS + FK;
  const nOrd = P.D / Q; const nOrdC = Math.ceil(nOrd - 1e-9);
  const freq = Math.floor(P.n / nOrdC + 1e-9);
  const Ku = Math.round(P.S * P.D / Q); const Kt = Math.round(P.Ky * Q / 2);
  const value = P.D * P.price; const TC = value + Ku + Kt;
  t.statement = [
    p(`Egy alapanyag éves felhasználása ${fmt(P.D)} db, beszerzési ára ${fmt(P.price)} Ft/db. Egy tétel rendelési költsége ${fmt(P.S)} Ft. ${P.monthly ? `Egy darab készletezési költsége ${fmt(P.Km)} Ft/hónap.` : `A fajlagos készlettartási költség ${fmt(P.Ky)} Ft/db/év.`}`),
    p(`Évente ${P.n} munkanappal számoljon; a rendelés átfutási ideje ${P.L} nap, a biztonsági készlet ${fmt(P.SS)} db. Fennállnak a gazdaságos rendelési tételnagyság feltételei. Kerekítés: minden műveletnél egész szám.`),
  ];
  addForm(t, 'k', null, ['Adat', 'Eredmény'], [
    { label: 'Éves fajlagos készlettartási költség (Ft/db/év)', field: { expect: P.Ky }, pts: 0.5 },
    { label: 'Optimális rendelési tételnagyság – EOQ (db)', field: { expect: Q, accept: [Math.ceil(Qx - 1e-9)] }, pts: 1.5 },
    { label: 'Napi felhasználás (db/munkanap)', field: { expect: Math.round(daily), accept: [Math.floor(daily), Math.ceil(daily)] }, pts: 0.5 },
    { label: 'Folyókészlet = napi felhasználás × átfutási idő (db)', field: { expect: FK, accept: [Math.round(daily * P.L)] }, pts: 1 },
    { label: 'Rendelési (jelző) készletszint (db)', field: { expect: JK, accept: [P.SS + Math.round(daily * P.L)] }, pts: 1 },
    { label: 'Rendelések száma évente (felfelé kerekítve)', field: { expect: nOrdC }, pts: 1 },
    { label: 'Rendelési gyakoriság (naponta, lefelé kerekítve)', field: { expect: freq, accept: [Math.round(P.n / nOrdC)] }, pts: 1 },
    { label: 'Éves rendelési költség (Ft)', field: { expect: Ku, tol: 2.01 }, pts: 1 },
    { label: 'Éves készlettartási költség (Ft)', field: { expect: Kt, tol: 2.01 }, pts: 1 },
    { label: 'Készletgazdálkodás összes költsége TC = R×C + Ku + Kt (Ft)', field: { expect: TC, tol: 4.01 }, pts: 1.5 },
  ]);
  t.hints = [
    'Ha a tartási költség havi, szorozd 12-vel. EOQ = √(2 × S × R ÷ K). A folyókészlet itt a rendelés átfutási ideje alatti felhasználás.',
    'Jelzőkészlet = biztonsági készlet + folyókészlet. Rendelések száma = R ÷ Q (felfelé), gyakoriság = munkanapok ÷ rendelések száma (lefelé). Ku = S × R ÷ Q, Kt = K × Q ÷ 2.',
    `K = ${fmt(P.Ky)} Ft/db/év; napi felhasználás = ${fmt(P.D)} ÷ ${P.n} = ${fmt(Math.round(daily))} db.`,
  ];
  t.solution = [
    p(`EOQ = √(2 × ${fmt(P.S)} × ${fmt(P.D)} ÷ ${fmt(P.Ky)}) = ${fmt(Qx, 2)} ≈ ${fmt(Q)} db`),
    p(`Folyókészlet = ${fmt(Math.round(daily))} × ${P.L} = ${fmt(FK)} db; jelzőkészlet = ${fmt(P.SS)} + ${fmt(FK)} = ${fmt(JK)} db`),
    p(`Rendelések száma = ${fmt(P.D)} ÷ ${fmt(Q)} = ${fmt(nOrd, 2)} → ${nOrdC}; gyakoriság = ${P.n} ÷ ${nOrdC} = ${fmt(P.n / nOrdC, 2)} → ${freq} naponta`),
    p(`Ku = ${fmt(P.S)} × ${fmt(P.D)} ÷ ${fmt(Q)} = ${fmt(Ku)} Ft; Kt = ${fmt(P.Ky)} × ${fmt(Q)} ÷ 2 = ${fmt(Kt)} Ft`),
    p(`TC = ${fmt(P.D)} × ${fmt(P.price)} + ${fmt(Ku)} + ${fmt(Kt)} = ${fmt(TC)} Ft`),
    note('Az optimumban a rendelési és a tartási költség egyenlő (kerekítés miatt kis eltérés lehet).'),
  ];

  t.walkthrough = [
    step('Tartási költség éves, darabra', f(P.monthly ? `K = ${fmt(P.Km)} Ft/db/hónap × 12 = ${fmt(P.Ky)} Ft/db/év` : `K = ${fmt(P.Ky)} Ft/db/év (adott)`)),
    step('EOQ', f(`Q = √(2 × S × R ÷ K) = √(2 × ${fmt(P.S)} × ${fmt(P.D)} ÷ ${fmt(P.Ky)}) = ${fmt(Qx, 2)} ≈ ${fmt(Q)} db`)),
    step('Napi felhasználás, folyókészlet, jelzőkészlet', f(`napi = ${fmt(P.D)} ÷ ${P.n} = ${fmt(daily, 2)} ≈ ${fmt(Math.round(daily))} db\nfolyókészlet (átfutás alatti fogyás) = ${fmt(Math.round(daily))} × ${P.L} = ${fmt(FK)} db\njelzőkészlet = biztonsági + folyó = ${fmt(P.SS)} + ${fmt(FK)} = ${fmt(JK)} db`)),
    step('Rendelések száma és gyakorisága', f(`R ÷ Q = ${fmt(P.D)} ÷ ${fmt(Q)} = ${fmt(nOrd, 2)} → ${nOrdC} rendelés (felfelé)\ngyakoriság = ${P.n} ÷ ${nOrdC} = ${fmt(P.n / nOrdC, 2)} → ${freq} naponta (lefelé, hogy ne fogyjunk ki)`)),
    step('Költségek', f(`Ku = S × R ÷ Q = ${fmt(P.S)} × ${fmt(P.D)} ÷ ${fmt(Q)} = ${fmt(Ku)} Ft\nKt = K × Q ÷ 2 = ${fmt(P.Ky)} × ${fmt(Q)} ÷ 2 = ${fmt(Kt)} Ft\nTC = R × C + Ku + Kt = ${fmt(P.D)} × ${fmt(P.price)} + ${fmt(Ku)} + ${fmt(Kt)} = ${fmt(TC)} Ft`), tip('A TC-be a beszerzési érték (R × C) is beletartozik – ez a legnagyobb tétel!')),
  ];
  return t;
}
