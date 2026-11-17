// Keys come from process.env or from a git-ignored `.env.local` file in the Mosaic home
// folder (see paths.mjs). Values are registered with the redactor on read and are never
// written to packs, sessions or logs.
import fs from 'node:fs';
import { registerSecret } from './redact.mjs';

/** Parse KEY=value lines (no export, no interpolation). Quotes around values are stripped. */
export function parseEnvFile(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/**
 * Build an env reader. Process env wins over the file.
 * @param {{ files?: string[], env?: Record<string,string|undefined> }} [opts]
 */
export function createEnv({ files = [], env = process.env } = {}) {
  const fromFiles = {};
  for (const f of files) {
    try {
      const parsed = parseEnvFile(fs.readFileSync(f, 'utf8'));
      for (const [k, v] of Object.entries(parsed)) if (!(k in fromFiles)) fromFiles[k] = v;
    } catch {
      // a missing .env.local is normal
    }
  }
  return {
    /** Value of a variable, or '' when unset. */
    get(name) {
      if (!name) return '';
      const v = env[name] ?? fromFiles[name] ?? '';
      if (v) registerSecret(v);
      return v;
    },
    has(name) {
      return Boolean(name && (env[name] || fromFiles[name]));
    },
  };
}
