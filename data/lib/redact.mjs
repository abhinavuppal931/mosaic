// Redaction: every URL or message that may reach a log, a pack or an error passes through here.

const SECRET_PARAM = /^(api[-_]?key|apikey|key|token|access[-_]?token|secret|registrationkey|client[-_]?secret|password|auth)$/i;
const known = new Set();

/** Register a secret value (an API key) so it is masked wherever it appears. */
export function registerSecret(value) {
  if (typeof value === 'string' && value.length >= 4) known.add(value);
}

/** Forget registered secrets (tests). */
export function clearSecrets() {
  known.clear();
}

/** Mask secret query parameters in a URL and any registered secret value. */
export function redactUrl(url) {
  let out = String(url ?? '');
  try {
    const u = new URL(out);
    let touched = false;
    for (const k of [...u.searchParams.keys()]) {
      if (SECRET_PARAM.test(k)) {
        u.searchParams.set(k, 'REDACTED');
        touched = true;
      }
    }
    if (u.username || u.password) {
      u.username = '';
      u.password = '';
      touched = true;
    }
    if (touched) out = u.toString();
  } catch {
    // not a URL; fall through to value masking
  }
  return redactText(out);
}

/** Mask registered secret values and obvious key=value pairs inside free text. */
export function redactText(text) {
  let out = String(text ?? '');
  for (const v of known) out = out.split(v).join('REDACTED');
  out = out.replace(/([?&](?:api[-_]?key|apikey|token|access[-_]?token|registrationkey)=)[^&\s"']+/gi, '$1REDACTED');
  out = out.replace(/(authorization:\s*bearer\s+)[^\s"']+/gi, '$1REDACTED');
  return out;
}
