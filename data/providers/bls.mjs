// US Bureau of Labor Statistics public API. v1 needs no key (about 25 queries a day per IP,
// last three years of data). With BLS_API_KEY set it uses v2 (500 a day, longer history).
import { ProviderError, result } from '../lib/contract.mjs';

const V1 = 'https://api.bls.gov/publicAPI/v1/timeseries/data/';
const V2 = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

/** Parse a BLS response for one series into ascending monthly observations. */
export function parseBls(body, seriesId) {
  if (!body || body.status !== 'REQUEST_SUCCEEDED') {
    const msg = [].concat(body?.message || []).join(' ').slice(0, 200) || 'request not processed';
    const limited = /threshold|limit/i.test(msg);
    throw new ProviderError(`bls: ${msg}`, { kind: limited ? 'rate_limit' : 'http', provider: 'bls' });
  }
  const s = body.Results?.series?.find((x) => x.seriesID === seriesId) || body.Results?.series?.[0];
  return (s?.data || [])
    .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period) && d.value !== '-' && Number.isFinite(Number(d.value)))
    .map((d) => ({ date: `${d.year}-${d.period.slice(1)}-01`, value: Number(d.value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default {
  id: 'bls',
  name: 'US Bureau of Labor Statistics',
  needsKey: false,
  keyEnv: 'BLS_API_KEY',
  capabilities: ['macroSeries'],
  cacheable: true,

  async getMacroSeries(seriesId, { years = 3 } = {}, ctx) {
    let body;
    if (ctx.key) {
      const end = new Date(ctx.now()).getUTCFullYear();
      body = await ctx.http.postJson(V2, { seriesid: [seriesId], startyear: String(end - Math.max(years, 2) + 1), endyear: String(end), registrationkey: ctx.key });
    } else {
      body = await ctx.http.getJson(`${V1}${encodeURIComponent(seriesId)}`);
    }
    const obs = parseBls(body, seriesId);
    if (!obs.length) return result(null, { source: 'bls' });
    return result(
      { id: seriesId, title: `BLS series ${seriesId}`, units: 'index or level', frequency: 'monthly', obs, url: `https://data.bls.gov/timeseries/${seriesId}` },
      { source: 'bls', asOf: obs[obs.length - 1].date, note: ctx.key ? 'BLS API v2' : 'BLS API v1 (no key)' },
    );
  },
};
