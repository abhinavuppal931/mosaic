// File cache for provider responses. One JSON file per key under the cache folder.
// TTLs are per capability (mosaic.config.json "cache.ttlSeconds"); 0 means never cache.
// Only successes are cached. Expired entries are kept so the router can serve them as
// "stale" when every live provider fails.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function createCache({ dir, now = () => Date.now(), enabled = true } = {}) {
  const fileFor = (key) => path.join(dir, crypto.createHash('sha256').update(key).digest('hex').slice(0, 32) + '.json');

  function read(key) {
    if (!enabled || !dir) return null;
    try {
      return JSON.parse(fs.readFileSync(fileFor(key), 'utf8'));
    } catch {
      return null;
    }
  }

  return {
    /** Fresh entry or null. */
    get(key, ttlSeconds) {
      if (!ttlSeconds || ttlSeconds <= 0) return null;
      const e = read(key);
      if (!e || e.key !== key) return null;
      return now() - e.storedAt <= ttlSeconds * 1000 ? e : null;
    },
    /** Any entry younger than maxAgeSeconds, fresh or not. */
    getStale(key, maxAgeSeconds) {
      const e = read(key);
      if (!e || e.key !== key) return null;
      return now() - e.storedAt <= maxAgeSeconds * 1000 ? e : null;
    },
    set(key, value) {
      if (!enabled || !dir) return;
      fs.mkdirSync(dir, { recursive: true });
      const tmp = fileFor(key) + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ key, storedAt: now(), value }));
      fs.renameSync(tmp, fileFor(key));
    },
  };
}
