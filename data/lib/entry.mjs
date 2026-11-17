// "Is this module the program being run?" for ESM command-line scripts.
// Compares real file paths, so it works on Windows (C:\...), with spaces or other
// percent-encoded characters in the path, and through symlinks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function real(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

/** True when the module at `metaUrl` (pass import.meta.url) is the script node was started with. */
export function isMain(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  const a = real(path.resolve(argv1));
  const b = real(fileURLToPath(metaUrl));
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}
