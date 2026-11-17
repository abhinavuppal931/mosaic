// Built-in providers plus any custom adapters named in mosaic.config.json.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateAdapter } from '../lib/contract.mjs';
import secEdgar from './sec-edgar.mjs';
import yahoo from './yahoo.mjs';
import treasury from './treasury.mjs';
import bls from './bls.mjs';
import nyfed from './nyfed.mjs';
import fred from './fred.mjs';
import fmp from './fmp.mjs';
import massive from './massive.mjs';
import finnhub from './finnhub.mjs';

export const BUILT_IN = Object.freeze([secEdgar, yahoo, treasury, bls, nyfed, fred, fmp, massive, finnhub]);

/**
 * Load every adapter. Custom entries: { id, module } where module is resolved from `baseDir`
 * (the folder of the config file that listed it). Bad custom adapters are reported, not loaded.
 * @returns {Promise<{ adapters: Map<string, object>, problems: string[] }>}
 */
export async function loadAdapters(config, { baseDir = process.cwd() } = {}) {
  const adapters = new Map(BUILT_IN.map((a) => [a.id, a]));
  const problems = [];
  for (const entry of config.custom || []) {
    if (!entry?.module) {
      problems.push(`custom provider ${entry?.id || '?'}: "module" is required`);
      continue;
    }
    const file = path.resolve(entry.baseDir || baseDir, entry.module);
    try {
      const mod = await import(pathToFileURL(file).href);
      const a = mod.default;
      const issues = validateAdapter(a);
      if (entry.id && a?.id !== entry.id) issues.push(`id "${a?.id}" does not match config id "${entry.id}"`);
      if (issues.length) {
        problems.push(`custom provider ${entry.id || file}: ${issues.join('; ')}`);
        continue;
      }
      if (adapters.has(a.id) && BUILT_IN.some((b) => b.id === a.id)) {
        problems.push(`custom provider ${a.id}: id clashes with a built-in provider`);
        continue;
      }
      adapters.set(a.id, a);
    } catch (err) {
      problems.push(`custom provider ${entry.id || file}: could not load (${err.message})`);
    }
  }
  return { adapters, problems };
}
