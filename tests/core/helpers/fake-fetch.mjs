// A fake fetch that serves recorded fixtures by URL pattern and fails loudly on anything else.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
export const HTTP = path.join(FIXTURES, 'http');

export function fixture(name) {
  return fs.readFileSync(path.join(HTTP, name), 'utf8');
}

/**
 * @param {{ match: RegExp | ((url:string, init:object)=>boolean), file?: string, body?: any, status?: number, headers?: object, times?: number }[]} routes
 */
export function fakeFetch(routes) {
  const calls = [];
  const used = new Map();
  const impl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    for (const [i, r] of routes.entries()) {
      const hit = typeof r.match === 'function' ? r.match(String(url), init) : r.match.test(String(url));
      if (!hit) continue;
      const n = used.get(i) || 0;
      if (r.times !== undefined && n >= r.times) continue;
      used.set(i, n + 1);
      if (r.throws) throw r.throws;
      const body = r.file ? fixture(r.file) : typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? {});
      return new Response(body, { status: r.status ?? 200, headers: r.headers || {} });
    }
    throw new Error(`unexpected network call in a test: ${url}`);
  };
  impl.calls = calls;
  return impl;
}

/** Block real network access for the whole test file. */
export function blockNetwork() {
  globalThis.fetch = async (url) => {
    throw new Error(`network disabled in tests: ${url}`);
  };
}
