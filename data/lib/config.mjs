// Load data/mosaic.config.json and deep-merge the user's override from the Mosaic home.
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN_ROOT } from './paths.mjs';

export const DEFAULT_CONFIG_PATH = path.join(PLUGIN_ROOT, 'data', 'mosaic.config.json');
export const SERIES_PATH = path.join(PLUGIN_ROOT, 'data', 'series.json');

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Deep merge: objects merge, arrays and scalars replace. */
export function deepMerge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : v;
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * @param {{ userConfigPath?: string, defaultPath?: string, overrides?: object }} [o]
 */
export function loadConfig({ userConfigPath, defaultPath = DEFAULT_CONFIG_PATH, overrides } = {}) {
  let cfg = readJson(defaultPath);
  const custom = (cfg.custom || []).map((c) => ({ ...c, baseDir: path.dirname(defaultPath) }));
  if (userConfigPath && fs.existsSync(userConfigPath)) {
    const user = readJson(userConfigPath);
    cfg = deepMerge(cfg, user);
    for (const c of user.custom || []) custom.push({ ...c, baseDir: path.dirname(userConfigPath) });
  }
  if (overrides) cfg = deepMerge(cfg, overrides);
  cfg.custom = custom;
  delete cfg.$comment;
  return cfg;
}

/**
 * Set one value in the user's mosaic.config.json (creating the file if needed), keeping
 * everything else. Written readable only by the user.
 * @param {string} file
 * @param {string[]} keyPath e.g. ['providers', 'sec-edgar', 'contact']
 */
export function writeUserConfigValue(file, keyPath, value) {
  let cfg = {};
  if (fs.existsSync(file)) {
    cfg = readJson(file);
    if (!isObj(cfg)) throw new Error(`${file} is not a JSON object`);
  }
  let node = cfg;
  for (const k of keyPath.slice(0, -1)) {
    if (!isObj(node[k])) node[k] = {};
    node = node[k];
  }
  node[keyPath[keyPath.length - 1]] = value;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // best effort on filesystems without POSIX modes
  }
}

export function loadSeries(file = SERIES_PATH) {
  const s = readJson(file);
  delete s.$comment;
  return s;
}
