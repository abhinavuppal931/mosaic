// Where Mosaic reads code from (the plugin root) and where it writes the user's state
// (the Mosaic home: sessions, journal, cache, .env.local).
//
// Home resolution, first match wins:
//   1. --home <dir> on the command line
//   2. MOSAIC_HOME env var
//   3. the plugin root, when it is a git clone (not inside Claude Code's plugin cache)
//   4. --plugin-data <dir> (the Chair passes ${CLAUDE_PLUGIN_DATA} for marketplace installs)
//   5. ~/.mosaic
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** True when a folder sits inside Claude Code's installed-plugin cache (read-only, replaced on update). */
export function isPluginCache(dir) {
  const p = path.resolve(dir).split(path.sep).join('/');
  return /\/\.claude\/plugins\/(cache|marketplaces)\//.test(p + '/');
}

/**
 * @param {{ home?: string, pluginData?: string, env?: Record<string,string|undefined>, pluginRoot?: string }} [o]
 */
export function resolveHome({ home, pluginData, env = process.env, pluginRoot = PLUGIN_ROOT } = {}) {
  if (home) return path.resolve(home);
  if (env.MOSAIC_HOME) return path.resolve(env.MOSAIC_HOME);
  if (!isPluginCache(pluginRoot)) return pluginRoot;
  if (pluginData && !pluginData.includes('${')) return path.resolve(pluginData);
  return path.join(os.homedir(), '.mosaic');
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
