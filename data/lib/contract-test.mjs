// Contract test for any adapter: call each declared capability once and check the shape.
// Used by `node data/cli.mjs check-provider <id>` and by the test suite.
import { CAPABILITIES, METHOD, SHAPES, validateAdapter, isEmpty } from './contract.mjs';

/**
 * @param {object} adapter
 * @param {{ router: object, symbol?: string, series?: string, managerCik?: string }} o
 * @returns {Promise<{ id: string, problems: string[], results: {capability:string, result:'pass'|'fail'|'empty'|'skipped', detail:string}[] }>}
 */
export async function checkProvider(adapter, { router, symbol = 'AAPL', series, seriesMap = {} }) {
  const problems = validateAdapter(adapter);
  const results = [];
  if (problems.length) return { id: adapter?.id, problems, results };
  for (const cap of CAPABILITIES) {
    if (!adapter.capabilities.includes(cap)) continue;
    const seriesId = series || Object.keys(seriesMap).find((k) => seriesMap[k]?.providers?.[adapter.id]) || 'ust_10y';
    const arg = cap === 'macroSeries' ? seriesId : symbol;
    const r = await router.get(cap, arg, cap === 'priceHistory' ? { years: 1 } : {}, { chain: [adapter.id] });
    const att = r.attempts.find((a) => a.provider === adapter.id);
    if (!att) {
      results.push({ capability: cap, result: 'skipped', detail: cap === 'macroSeries' ? `no mapping for series ${seriesId} in data/series.json` : 'not attempted' });
      continue;
    }
    if (att.status === 'skipped') {
      results.push({ capability: cap, result: 'skipped', detail: att.note });
      continue;
    }
    if (att.status === 'error') {
      results.push({ capability: cap, result: 'fail', detail: `${att.kind}: ${att.note}` });
      continue;
    }
    if (isEmpty(r.data)) {
      results.push({ capability: cap, result: 'empty', detail: att.note || 'provider answered with no data' });
      continue;
    }
    const shape = SHAPES[cap](r.data);
    const metaProblems = [];
    if (r.meta.source !== adapter.id) metaProblems.push(`meta.source should be "${adapter.id}"`);
    if (r.meta.asOf && !/^\d{4}-\d{2}-\d{2}/.test(r.meta.asOf)) metaProblems.push('meta.asOf should be YYYY-MM-DD');
    const all = [...shape, ...metaProblems];
    results.push({ capability: cap, result: all.length ? 'fail' : 'pass', detail: all.join('; ') || `${METHOD[cap]} ok` });
  }
  return { id: adapter.id, problems, results };
}
