// FRED (Federal Reserve Bank of St. Louis). Needs a free key: FRED_API_KEY.
// FRED's terms do not allow storing or caching API content, so this adapter is not cached
// and its data lives only in the user's own session folder.
import { result } from '../lib/contract.mjs';

const BASE = 'https://api.stlouisfed.org/fred/series/observations';

export default {
  id: 'fred',
  name: 'FRED (St. Louis Fed)',
  needsKey: true,
  keyEnv: 'FRED_API_KEY',
  capabilities: ['macroSeries'],
  cacheable: false,

  async getMacroSeries(seriesId, { years = 3 } = {}, ctx) {
    const start = new Date(ctx.now() - years * 365.25 * 86_400_000).toISOString().slice(0, 10);
    const qs = new URLSearchParams({ series_id: seriesId, api_key: ctx.key, file_type: 'json', observation_start: start });
    const body = await ctx.http.getJson(`${BASE}?${qs}`, { allow404: true });
    const obs = (body?.observations || [])
      .filter((o) => o.value !== '.' && Number.isFinite(Number(o.value)))
      .map((o) => ({ date: o.date, value: Number(o.value) }));
    if (!obs.length) return result(null, { source: 'fred' });
    return result(
      { id: seriesId, title: `FRED ${seriesId}`, units: body.units || null, frequency: null, obs, url: `https://fred.stlouisfed.org/series/${seriesId}` },
      { source: 'fred', asOf: obs[obs.length - 1].date },
    );
  },
};
