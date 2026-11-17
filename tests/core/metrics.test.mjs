import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../data/lib/metrics.mjs';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('basic statistics', () => {
  assert.equal(M.mean([1, 2, 3, null]), 2);
  close(M.stdev([2, 4, 4, 4, 5, 5, 7, 9]), 2.138089935299395);
  assert.equal(M.median([3, 1, 2]), 2);
  assert.equal(M.median([4, 1, 2, 3]), 2.5);
  assert.equal(M.mean([]), null);
  assert.equal(M.stdev([1]), null);
});

test('ratios refuse zero and negative bases where meaningless', () => {
  assert.equal(M.ratio(1, 0), null);
  assert.equal(M.posRatio(10, -2), null);
  assert.equal(M.posRatio(10, 2), 5);
});

test('CAGR needs positive endpoints', () => {
  close(M.cagr(100, 121, 2), 0.1);
  assert.equal(M.cagr(-1, 10, 3), null);
  assert.equal(M.cagr(1, 10, 0), null);
});

test('percentile rank and drawdown', () => {
  assert.equal(M.percentileRank([1, 2, 3, 4], 3), 0.75);
  const dd = M.maxDrawdown([{ t: 'a', c: 100 }, { t: 'b', c: 120 }, { t: 'c', c: 60 }, { t: 'd', c: 130 }]);
  assert.equal(dd.value, -0.5);
  assert.deepEqual([dd.from, dd.to], ['b', 'c']);
});

test('volatility, skew and kurtosis behave on known inputs', () => {
  const flat = Array.from({ length: 30 }, () => 100);
  assert.equal(M.annualVol(flat), 0);
  assert.equal(M.annualVol([1, 2]), null);
  close(M.skewness([1, 2, 3, 4, 5]), 0);
  assert.ok(M.skewness([1, 1, 1, 1, 10]) > 0);
  assert.ok(M.excessKurtosis([0, 0, 0, 0, 0, 0, 0, 0, 0, 10, -10]) > 0);
});

test('returnOver reads the close on or before the target date', () => {
  const pts = [{ t: '2025-01-01', adjC: 100 }, { t: '2025-06-01', adjC: 110 }, { t: '2026-01-01', adjC: 121 }];
  close(M.returnOver(pts, 365), 0.21);
  assert.equal(M.returnOver(pts, 5000), null);
});

test('DCF and its inverse agree', () => {
  const args = { cash0: 100, discount: 0.09, terminalGrowth: 0.025, years: 10 };
  const v = M.dcfValue({ ...args, growth: 0.12 });
  close(M.impliedGrowth({ ...args, price: v }), 0.12, 1e-7);
  // A zero-growth stream is worth cash0 x (1 + gT) discounted, a closed form check.
  const flat = M.dcfValue({ ...args, growth: 0 });
  let pv = 0;
  for (let t = 1; t <= 10; t++) pv += 100 / 1.09 ** t;
  close(flat, pv + (100 * 1.025) / (0.09 - 0.025) / 1.09 ** 10, 1e-6);
  assert.equal(M.impliedGrowth({ ...args, price: 10, cash0: -5 }), null);
  assert.equal(M.dcfValue({ ...args, growth: 0.1, discount: 0.02 }), null);
});

test('year-over-year on a monthly index', () => {
  const obs = [{ date: '2025-10-01', value: 100 }, { date: '2026-09-01', value: 102 }, { date: '2026-10-01', value: 103 }];
  const y = M.yoyLast(obs);
  close(y.value, 3);
  assert.equal(y.priorDate, '2025-10-01');
});

test('correlation of identical and opposite series', () => {
  const a = Array.from({ length: 30 }, (_, i) => Math.sin(i));
  close(M.correlation(a, a), 1);
  close(M.correlation(a, a.map((x) => -x)), -1);
  assert.equal(M.correlation([1, 2], [1, 2]), null);
});

test('year-over-year steps back past a month the source never printed', () => {
  // BLS has no October 2025 print, so October 2026 cannot be compared; September can.
  const obs = [{ date: '2025-09-01', value: 100 }, { date: '2026-09-01', value: 103 }, { date: '2026-10-01', value: 104 }];
  const y = M.yoyLast(obs);
  close(y.value, 3);
  assert.equal(y.date, '2026-09-01');
  assert.equal(y.skipped, 1);
  assert.equal(M.yoyLast([{ date: '2026-10-01', value: 1 }]), null);
});
