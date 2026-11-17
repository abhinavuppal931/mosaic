// Shared builders for tests: a router over fixtures with no waiting and no cache.
import { createRouter } from '../../../data/router.mjs';
import { loadAdapters } from '../../../data/providers/index.mjs';
import { loadConfig, loadSeries } from '../../../data/lib/config.mjs';
import { createEnv } from '../../../data/lib/env.mjs';
import { fakeFetch } from './fake-fetch.mjs';

/** 2026-11-17T12:00:00Z, the day the fixtures were recorded. */
export const NOW = Date.parse('2026-11-17T12:00:00Z');

/** A test SEC contact (name and email), as MOSAIC_SEC_CONTACT would hold it. */
export const SEC_CONTACT = 'Mosaic Tests tests@example.com';

/** Routes that make the zero-key stack answer for MSFT from recorded fixtures. */
export const FREE_ROUTES = [
  { match: /sec\.gov\/files\/company_tickers\.json/, file: 'sec-company-tickers.json' },
  { match: /data\.sec\.gov\/submissions\/CIK0000789019\.json/, file: 'sec-submissions-msft.json' },
  { match: /data\.sec\.gov\/submissions\/CIK0001067983\.json/, file: 'sec-submissions-brk.json' },
  { match: /companyfacts\/CIK0000789019\.json/, file: 'sec-companyfacts-msft.json' },
  { match: /Archives\/edgar\/data\/789019\/.*\/form4\.xml/, file: 'sec-form4-msft.xml' },
  { match: /Archives\/edgar\/data\/1067983\/.*\/index\.json/, file: 'sec-13f-index-brk.json' },
  { match: /Archives\/edgar\/data\/1067983\/.*\/60471\.xml/, file: 'sec-13f-infotable-brk.xml' },
  { match: /chart\/MSFT\?range=5d/, file: 'yahoo-chart-msft-5d.json' },
  { match: /chart\/MSFT\?range=\d+y/, file: 'yahoo-chart-msft-5y.json' },
  { match: /chart\/SPY\?range=\d+y/, file: 'yahoo-chart-spy-5y.json' },
  { match: /daily-treasury-rates\.csv\/2025\//, file: 'treasury-2025.csv' },
  { match: /daily-treasury-rates\.csv\/2026\//, file: 'treasury-2026.csv' },
  { match: /newyorkfed\.org\/api\/rates\/unsecured\/effr/, file: 'nyfed-effr.json' },
  { match: /api\.bls\.gov\/publicAPI\/v1\/timeseries\/data\/CUUR0000SA0L1E/, file: 'bls-v1-CUUR0000SA0L1E.json' },
  { match: /api\.bls\.gov\/publicAPI\/v1\/timeseries\/data\/CUUR0000SA0$/, file: 'bls-v1-CUUR0000SA0.json' },
  { match: /api\.bls\.gov\/publicAPI\/v1\/timeseries\/data\/LNS14000000/, file: 'bls-v1-LNS14000000.json' },
  { match: /api\.bls\.gov\/publicAPI\/v1\/timeseries\/data\/CES0000000001/, file: 'bls-v1-CES0000000001.json' },
];

/**
 * @param {{ routes?: object[], env?: Record<string,string>, overrides?: object, cacheDir?: string, now?: ()=>number, log?: Function }} [o]
 */
export async function makeRouter({ routes = FREE_ROUTES, env = { MOSAIC_SEC_CONTACT: SEC_CONTACT }, overrides, cacheDir, now = () => NOW, log } = {}) {
  const config = loadConfig({ overrides: { http: { retries: 1, backoffMs: 1 }, pack: { historyYears: 5 }, ...(overrides || {}) } });
  if (!cacheDir) config.cache.enabled = false;
  const { adapters } = await loadAdapters(config);
  const fetchImpl = fakeFetch(routes);
  // A virtual wall clock: sleeping advances it, so rate limits and backoff cost no real time.
  const wall = { t: 0, slept: [] };
  const clock = () => wall.t;
  const sleep = async (ms) => {
    wall.slept.push(ms);
    wall.t += ms;
  };
  const router = createRouter({ config, adapters, env: createEnv({ env }), series: loadSeries(), fetchImpl, cacheDir, now, clock, sleep, log });
  return { router, config, fetchImpl, adapters, series: loadSeries(), wall };
}
