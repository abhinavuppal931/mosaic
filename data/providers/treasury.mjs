// US Treasury daily par yield curve (home.treasury.gov). Free, no key, public domain.
// Series ids are the CSV column names ("3 Mo", "2 Yr", "10 Yr", ...), mapped in data/series.json.
import { result } from '../lib/contract.mjs';

const BASE = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv';

/** Parse the yield-curve CSV into { columns, rows: [{date, values: {col: number}}] }. */
export function parseCurveCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length < 2) return { columns: [], rows: [] };
  const split = (l) => l.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
  const columns = split(lines[0]);
  const rows = [];
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const m = cells[0].match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) continue;
    const values = {};
    columns.slice(1).forEach((c, i) => {
      const v = Number(cells[i + 1]);
      if (cells[i + 1] !== '' && Number.isFinite(v)) values[c] = v;
    });
    rows.push({ date: `${m[3]}-${m[1]}-${m[2]}`, values });
  }
  return { columns, rows };
}

export default {
  id: 'treasury',
  name: 'US Treasury yield curve',
  needsKey: false,
  keyEnv: null,
  capabilities: ['macroSeries'],
  cacheable: true,

  async getMacroSeries(seriesId, { years = 2 } = {}, ctx) {
    const thisYear = new Date(ctx.now()).getUTCFullYear();
    const rows = [];
    for (let y = thisYear - years + 1; y <= thisYear; y++) {
      const url = `${BASE}/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
      const text = await ctx.http.getText(url, { allow404: true });
      rows.push(...parseCurveCsv(text).rows);
    }
    const obs = rows
      .filter((r) => r.values[seriesId] !== undefined)
      .map((r) => ({ date: r.date, value: r.values[seriesId] }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!obs.length) return result(null, { source: 'treasury' });
    return result(
      { id: seriesId, title: `Treasury par yield, ${seriesId}`, units: 'percent', frequency: 'daily', obs, url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates' },
      { source: 'treasury', asOf: obs[obs.length - 1].date },
    );
  },
};
