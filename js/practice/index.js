// Gyakorlati feladatgenerátorok nyilvántartása.
import { rng } from '../util.js';
import * as drp from './drp.js';
import * as supplier from './supplier.js';
import * as eoq from './eoq.js';
import * as mrp from './mrp.js';
import * as johnson from './johnson.js';
import * as turnover from './turnover.js';
import * as production from './production.js';
import * as route from './route.js';
import * as valuation from './valuation.js';

export const GENERATORS = [drp, supplier, eoq, mrp, johnson, turnover, production, route, valuation]
  .sort((a, b) => a.meta.order - b.meta.order);

export const byKind = Object.fromEntries(GENERATORS.map((g) => [g.meta.kind, g]));

/** Feladatpéldány előállítása: ref = {kind, seed, preset} */
export function makePractice(ref) {
  const g = byKind[ref.kind];
  const t = g.generate(rng(ref.seed), ref.preset);
  t.id = `p-${ref.kind}-${ref.preset === 'vizsga' ? 'vizsga' : ref.seed}`;
  t.ref = ref;
  return t;
}
