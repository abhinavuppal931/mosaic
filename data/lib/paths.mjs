// Where Mosaic reads code from (the plugin root) and where it writes the user's state
// (the Mosaic home: sessions, journal, cache, .env.local).
//
// Home resolution, first match wins:
//   1. --home <dir> on the command line
//   2. MOSAIC_HOME env var
//   3. the plugin root, when it is a git clone that already holds Mosaic state (an older clone)
//   4. --plugin-data <dir>, when it already holds Mosaic state (an older marketplace install)
//   5. ~/.mosaic, the default for every new install, clone or marketplace
//
// ~/.mosaic is the default because Claude Code treats files under ~/.claude as sensitive and asks
// before every write there, and a council writes a dozen files. The /mosaic skill pre-approves
// writes to ~/.mosaic, so a council runs without approval prompts. One home also means a clone and
// a marketplace install share the same sessions and journal.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** True when a folder sits inside Claude Code's installed-plugin cache (read-only, replaced on update). */
export function isPluginCache(dir) {
  const p = path.resolve(dir).split(path.sep).join('/');
  return /\/\.claude\/plugins\/(cache|marketplaces)\//.test(p + '/');
}

/** True when a folder already holds a user's Mosaic state (sessions, journal, keys or config). */
export function hasState(dir) {
  if (!dir) return false;
  const has = (rel, test = () => true) => {
    try {
      return fs.readdirSync(path.join(dir, rel)).some(test);
    } catch {
      return false;
    }
  };
  if (has('sessions', (n) => !n.startsWith('.'))) return true;
  if (has('journal', (n) => n.endsWith('.json'))) return true;
  return ['.env.local', 'mosaic.config.json'].some((f) => fs.existsSync(path.join(dir, f)));
}

/** The default home for new installs: ~/.mosaic. */
export const defaultHome = () => path.join(os.homedir(), '.mosaic');

/**
 * @param {{ home?: string, pluginData?: string, env?: Record<string,string|undefined>, pluginRoot?: string }} [o]
 */
export function resolveHome({ home, pluginData, env = process.env, pluginRoot = PLUGIN_ROOT } = {}) {
  if (home) return path.resolve(home);
  if (env.MOSAIC_HOME) return path.resolve(env.MOSAIC_HOME);
  if (!isPluginCache(pluginRoot) && hasState(pluginRoot)) return pluginRoot;
  if (pluginData && !pluginData.includes('${') && hasState(pluginData)) return path.resolve(pluginData);
  return defaultHome();
}

/** Every path Mosaic uses, derived from the home folder. */
export function paths(opts = {}) {
  const home = resolveHome(opts);
  return {
    pluginRoot: opts.pluginRoot || PLUGIN_ROOT,
    home,
    sessions: path.join(home, 'sessions'),
    journal: path.join(home, 'journal'),
    cache: path.join(home, '.cache', 'mosaic'),
    envFile: path.join(home, '.env.local'),
    userConfig: path.join(home, 'mosaic.config.json'),
    roster: path.join(opts.pluginRoot || PLUGIN_ROOT, 'skills', 'mosaic', 'roster.json'),
    brains: path.join(opts.pluginRoot || PLUGIN_ROOT, 'skills', 'mosaic', 'brains'),
  };
}
