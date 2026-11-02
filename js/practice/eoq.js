// 3. feladattípus – Gazdaságos rendelési tételnagyság (EOQ / Wilson-modell), 6 pont
import { makeTask, addForm, p, note } from './common.js';
import { fmt } from '../util.js';

export const meta = { kind: 'eoq', title: 'Gazdaságos rendelési tételnagyság, költségek, rendelési készletszint', points: 6, exam: true, order: 3 };

export function generate(r, preset) {
  let P;
  if (preset === 'vizsga') P = { D: 15000, price: 1200, h: 12, S: 300, L: 5, SS: 100 };
  else if (preset === 'v23') P = { D: 50000, price: 900, h: 10, S: 40, L: 4, SS: 50 };
  else {
    for (let i = 0; i < 500; i++) {
      const Q = r.pick([100, 120, 150, 200, 240, 250, 300, 400, 500, 600]);
      const price = r.pick([500, 600, 800, 1000, 1200, 1500, 2000, 2400]);
      const h = r.pick([10, 12, 15, 20, 24, 25]);
      const S = r.pick([200, 250, 300, 400, 500, 600, 800]);
      const D = (Q * Q * price * h) / 100 / (2 * S);
      if (Number.isInteger(D) && D >= 3000 && D <= 120000 && D % 12 === 0) { P = { D, price, h, S, L: r.int(3, 10), SS: r.int(5, 30) * 10 }; break; }
    }
    if (!P) P = { D: 15000, price: 1200, h: 12, S: 300, L: 5, SS: 100 };
  }
  return build(P);
}

function build(P) {
  const t = makeTask({ ...meta, params: P });
  const H = P.price * P.h / 100;
  const Qexact = Math.sqrt(2 * P.D * P.S / H);
  const Q = Math.round(Qexact);
  const Qc = Math.ceil(Qexact - 1e-9);
  const daily = P.D / 360;
  const ropExact = daily * P.L + P.SS;
  const rop = Math.round(daily) * P.L + P.SS; // a vizsgamegoldások a napi felhasználást előbb egészre kerekítik
  const nOrders = P.D / Q;
  const ordM = nOrders * P.S / 12;
  const holdM = (Q / 2) * H / 12;
  const alt = (f) => [...new Set([Math.round(f(Qc))])].filter((v) => v !== Math.round(f(Q)));

  t.statement = [
    p('Egy alapanyag felhasználása viszonylag állandó és az év közbeni eloszlása egyenletes.'),
    p(`Az alapanyag éves felhasználása ${fmt(P.D)} darab, amelyet ${fmt(P.price)} Ft/db nettó beszerzési áron vásárolnak meg. A beszállító nem bontja meg a kiszerelési egységeket. A cég évi ${P.h}%-os készlettartási költséggel számol a nettó beszerzési ár százalékában. Egy tétel megrendelésének költsége ${fmt(P.S)} Ft. Éves szinten 360 naptári nappal számoljon!`),
    p('Kerekítési pontosság: egész. Részszámításait a megadott táblázatban vezesse le!'),
  ];
  addForm(t, 'q', null, ['Kérdés', 'Eredmény'], [
    { label: 'Hány darab az optimális rendelési tételnagyság? (db)', field: { expect: Q, accept: Qc !== Q ? [Qc] : [], unit: 'db' }, pts: 2 },
    { label: `Hány darabos készletszintnél kell feladni a megrendelést, ha a rendelés teljesítésének átfutási ideje ${P.L} naptári nap, és a cégvezetés határozata alapján ${fmt(P.SS)} darab biztonsági készletet tartanak? (db)`, field: { expect: rop, accept: [Math.round(ropExact), Math.ceil(ropExact - 1e-9)].filter((v) => v !== rop), unit: 'db' }, pts: 2 },
    { label: 'Mennyi a havi rendelési (előkészítési) költség? (Ft)', field: { expect: Math.round(ordM), accept: alt((q) => P.D / q * P.S / 12), tol: 1.01, unit: 'Ft' }, pts: 1 },
    { label: 'Mennyi a havi készlettartási költség? (Ft) (a biztonsági készlettől tekintsen el)', field: { expect: Math.round(holdM), accept: alt((q) => q / 2 * H / 12), tol: 1.01, unit: 'Ft' }, pts: 1 },
  ]);
  t.hints = [
    'Wilson-képlet: Q* = √(2 × éves szükséglet × rendelési költség ÷ egységnyi éves készlettartási költség). Az egységnyi tartási költség = ár × tartási %.',
    'Rendelési készletszint = napi felhasználás × átfutási idő + biztonsági készlet. Éves rendelési költség = (éves szükséglet ÷ Q*) × rendelési költség; éves tartási költség = (Q* ÷ 2) × egységnyi tartási költség. A havi érték ezek tizenkettede.',
    `Egységnyi tartási költség: ${fmt(P.price)} × ${P.h}% = ${fmt(H)} Ft/db/év. Napi felhasználás: ${fmt(P.D)} ÷ 360 = ${fmt(daily, 2)} db.`,
  ];
  t.solution = [
    p(`Q* = √(2 × ${fmt(P.D)} × ${fmt(P.S)} ÷ ${fmt(H)}) = √${fmt(Math.round(2 * P.D * P.S / H))} = ${fmt(Qexact, 2)} ≈ ${fmt(Q)} db`),
    p(`Napi felhasználás: ${fmt(P.D)} ÷ 360 = ${fmt(daily, 2)} ≈ ${fmt(Math.round(daily))} db → rendelési készletszint = ${fmt(Math.round(daily))} × ${P.L} + ${fmt(P.SS)} = ${fmt(rop)} db`),
    note(`A tanfolyami vizsgamegoldások a napi felhasználást előbb egészre kerekítik. Kerekítés nélkül ${fmt(ropExact, 2)} ≈ ${fmt(Math.round(ropExact))} db jönne ki – ezt is elfogadjuk. Az EOQ-t néhány megoldás felfelé kerekíti (${fmt(Qc)} db), ez is elfogadott.`),
    p(`Rendelések száma: ${fmt(P.D)} ÷ ${fmt(Q)} = ${fmt(nOrders, 2)} /év → éves rendelési költség ${fmt(Math.round(nOrders * P.S))} Ft → havi ${fmt(Math.round(ordM))} Ft`),
    p(`Átlagkészlet ${fmt(Q)} ÷ 2 = ${fmt(Q / 2)} db → éves tartási költség ${fmt(Math.round(Q / 2 * H))} Ft → havi ${fmt(Math.round(holdM))} Ft`),
    note('Ellenőrzés: az optimumban a rendelési és a készlettartási költség megegyezik.'),
  ];
  return t;
}
