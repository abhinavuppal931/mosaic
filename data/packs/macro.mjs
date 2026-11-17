// Macro facts: rates, curve, policy rate, inflation, labor, credit spreads, volatility.
// Used on its own (`pack --macro`) and as context inside ticker and portfolio packs.
import * as M from '../lib/metrics.mjs';

const { isNum } = M;

export async function fetchMacroData(router, ids, { years = 2 } = {}) {
  const out = {};
  for (const id of ids) out[id] = await router.get('macroSeries', id, { years: Math.max(years, 2) });
  return out;
}

/** Add facts for each series id; returns the ids of facts added. */
export function addMacroFacts(fb, macro, { series, ids }) {
  const added = {};
  for (const id of ids) {
    const r = macro[id];
    const def = series[id] || { label: id, units: '' };
    if (!r) continue;
    const obs = r.data?.obs || [];
    const last = obs[obs.length - 1];
    const meta = r.meta;
    if (def.transform === 'yoy') {
      const y = M.yoyLast(obs);
      added[id] = fb.add({ key: `macro_${id}_yoy`, label: `${def.label.replace(/ \(index.*\)$/, '')}, year-over-year change`, value: y?.value ?? null, unit: 'percent', period: y ? `${y.date.slice(0, 7)} vs ${y.priorDate.slice(0, 7)}` : undefined, meta: { ...meta, asOf: y?.date || meta.asOf }, url: r.data?.url, dp: 2, note: y?.skipped ? `the latest ${y.skipped} month(s) have no print a year earlier in the source, so the comparison uses ${y.date.slice(0, 7)}` : undefined });
      continue;
    }
    added[id] = fb.add({ key: `macro_${id}`, label: def.label, value: last?.value ?? null, unit: def.units, period: last?.date, meta: { ...meta, asOf: last?.date || meta.asOf }, url: r.data?.url });
    if (last && obs.length > 200) {
      const yearAgo = M.valueOnOrBefore(obs, new Date(Date.parse(last.date) - 365 * 86_400_000).toISOString().slice(0, 10));
      if (yearAgo && def.units === 'percent') {
        fb.derive({ key: `macro_${id}_change_1y`, label: `${def.label}, change over 12 months`, value: last.value - yearAgo.value, unit: 'percentage points', period: `${yearAgo.date} to ${last.date}`, formula: `${id}(latest) - ${id}(one year earlier)`, inputs: [added[id]], dp: 4 });
      }
    }
    if (id === 'policy_rate' && r.data?.targetRange) {
      fb.add({ key: 'macro_policy_target_range', label: 'Fed funds target range', value: `${r.data.targetRange[0]} to ${r.data.targetRange[1]}`, unit: 'percent', period: last?.date, meta: { ...meta, asOf: last?.date || meta.asOf }, url: r.data?.url });
    }
  }
  const v = (k) => fb.value(k);
  if (ids.includes('ust_10y') && ids.includes('ust_2y')) {
    fb.derive({ key: 'macro_curve_10y_2y', label: 'Yield curve: 10-year minus 2-year Treasury', value: isNum(v('macro_ust_10y')) && isNum(v('macro_ust_2y')) ? v('macro_ust_10y') - v('macro_ust_2y') : null, unit: 'percentage points', formula: 'ust_10y - ust_2y', inputs: [fb.id('macro_ust_10y'), fb.id('macro_ust_2y')], dp: 4 });
  }
  if (ids.includes('ust_10y') && ids.includes('ust_3m')) {
    fb.derive({ key: 'macro_curve_10y_3m', label: 'Yield curve: 10-year minus 3-month Treasury', value: isNum(v('macro_ust_10y')) && isNum(v('macro_ust_3m')) ? v('macro_ust_10y') - v('macro_ust_3m') : null, unit: 'percentage points', formula: 'ust_10y - ust_3m', inputs: [fb.id('macro_ust_10y'), fb.id('macro_ust_3m')], dp: 4 });
  }
  if (ids.includes('policy_rate') && ids.includes('cpi')) {
    fb.derive({ key: 'macro_real_policy_rate', label: 'Real policy rate (policy rate minus CPI inflation)', value: isNum(v('macro_policy_rate')) && isNum(v('macro_cpi_yoy')) ? v('macro_policy_rate') - v('macro_cpi_yoy') : null, unit: 'percentage points', formula: 'policy_rate - cpi_yoy', inputs: [fb.id('macro_policy_rate'), fb.id('macro_cpi_yoy')], dp: 4 });
  }
  return added;
}

/** Monthly-sampled history of each series for the pack's `series` block (keeps packs small). */
export function macroSeriesBlock(macro) {
  const out = {};
  for (const [id, r] of Object.entries(macro)) {
    const obs = r?.data?.obs || [];
    if (!obs.length) continue;
    const byMonth = new Map();
    for (const o of obs) byMonth.set(o.date.slice(0, 7), o);
    out[id] = { source: r.meta.source, asOf: r.meta.asOf, status: r.meta.status, points: [...byMonth.values()].map((o) => [o.date, o.value]) };
  }
  return out;
}
