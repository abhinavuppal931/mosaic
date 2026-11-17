// Federal Reserve Bank of New York reference rates (markets.newyorkfed.org). Free, no key.
// Supplies the effective federal funds rate (EFFR) so the zero-key macro pack has a policy rate.
import { result } from '../lib/contract.mjs';

const BASE = 'https://markets.newyorkfed.org/api/rates/unsecured';

export default {
  id: 'nyfed',
  name: 'New York Fed reference rates',
  needsKey: false,
  keyEnv: null,
  capabilities: ['macroSeries'],
  cacheable: true,

  async getMacroSeries(seriesId, { observations = 500 } = {}, ctx) {
    const body = await ctx.http.getJson(`${BASE}/${encodeURIComponent(seriesId)}/last/${observations}.json`, { allow404: true });
    const rows = body?.refRates || [];
    const obs = rows
      .filter((r) => typeof r.percentRate === 'number')
      .map((r) => ({ date: r.effectiveDate, value: r.percentRate }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!obs.length) return result(null, { source: 'nyfed' });
    const last = rows.find((r) => r.effectiveDate === obs[obs.length - 1].date);
    return result(
      {
        id: seriesId,
        title: 'Effective federal funds rate',
        units: 'percent',
        frequency: 'daily',
        obs,
        targetRange: last && last.targetRateFrom !== undefined ? [last.targetRateFrom, last.targetRateTo] : null,
        url: 'https://www.newyorkfed.org/markets/reference-rates/effr',
      },
      { source: 'nyfed', asOf: obs[obs.length - 1].date },
    );
  },
};
