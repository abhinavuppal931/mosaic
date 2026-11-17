// Human view of a data pack (data-pack.md). Seats read the JSON; people read this.
const PCT = new Set(['ratio']);

export function formatValue(f) {
  if (f.value === null || f.value === undefined) return `MISSING${f.note ? ` (${f.note})` : ''}`;
  const v = f.value;
  if (typeof v !== 'number') return String(v);
  if (PCT.has(f.unit)) return `${(v * 100).toFixed(1)}%`;
  if (f.unit === 'percent') return `${v.toFixed(2)}%`;
  if (f.unit === 'percentage points') return `${v >= 0 ? '+' : ''}${v.toFixed(2)} pts`;
  if (f.unit === 'x') return `${v.toFixed(1)}x`;
  if (f.unit === 'USD' || f.unit === 'shares') return big(v) + (f.unit === 'USD' ? ' USD' : ' shares');
  if (/\/share$/.test(f.unit || '')) return `${v.toFixed(2)} ${f.unit.replace('/share', '')}`;
  if (f.unit === 'count') return String(Math.round(v));
  return Number.isInteger(v) ? String(v) : v.toFixed(3);
}

function big(v) {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e12) return `${s}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1)}M`;
  return `${s}${Math.round(a).toLocaleString('en-US')}`;
}

const esc = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');

export function renderPackMarkdown(pack) {
  const title = pack.kind === 'ticker' ? `${pack.symbol}` : pack.kind === 'macro' ? 'Macro' : `Portfolio (${pack.holdings.length} holdings)`;
  const out = [];
  out.push(`# Data pack: ${title}`, '');
  out.push(`As of ${pack.asOf} · generated ${pack.generatedAt} · ${pack.facts.length} facts (${pack.coverage.missingFacts} missing) · coverage ${Math.round(pack.coverage.score * 100)}% · ${pack.hash}`, '');
  out.push('Seats cite facts as [F014]. A number that is not in this pack is outside the pack and unverified. MISSING means no configured source had it; it is never filled in.', '');
  out.push('## Data health', '');
  out.push('| Capability | Status | Source | As of | Note |', '|---|---|---|---|---|');
  for (const p of pack.providers) out.push(`| ${p.capability} | ${p.status} | ${p.source || '-'} | ${p.asOf || '-'} | ${esc(p.note || attemptsLine(p.attempts))} |`);
  out.push('');
  if (pack.warnings.length) {
    out.push('## Warnings', '');
    for (const w of pack.warnings) out.push(`- ${w}`);
    out.push('');
  }
  out.push('## Facts', '');
  out.push('| Id | Fact | Value | Period | Source | As of | Status |', '|---|---|---|---|---|---|---|');
  for (const f of pack.facts) out.push(`| ${f.id} | ${esc(f.label)} | ${esc(formatValue(f))} | ${esc(f.period || '')} | ${f.source || '-'} | ${f.asOf || '-'} | ${f.status} |`);
  out.push('');
  const derived = pack.facts.filter((f) => f.derived && f.value !== null);
  if (derived.length) {
    out.push('## Formulas', '');
    for (const f of derived) out.push(`- ${f.id} ${f.label}: \`${f.formula}\`${f.inputs?.length ? ` (inputs ${f.inputs.join(', ')})` : ''}${f.note ? `. ${f.note}` : ''}`);
    out.push('');
  }
  out.push('## Seat evidence', '');
  for (const [seat, e] of Object.entries(pack.packs)) {
    out.push(`### ${seat}`, '');
    out.push(`Facts: ${e.facts.join(', ') || 'none'} · coverage ${Math.round(e.coverage * 100)}% · evidence cap: ${e.evidenceCap}${e.missing.length ? ` · missing: ${e.missing.join(', ')}` : ''}`);
    if (e.checks.length) {
      out.push('');
      for (const c of e.checks) out.push(`- [${c.result}] ${c.label} (${c.fact || c.metric}${c.value !== null ? ` = ${round(c.value)}` : ''}, heuristic)`);
    }
    out.push('');
  }
  if (pack.news?.length) {
    out.push('## Headlines', '');
    for (const n of pack.news) out.push(`- ${n.time?.slice(0, 10)} ${esc(n.title)} (${n.source})`);
    out.push('');
  }
  out.push('---', pack.disclaimer, '');
  return out.join('\n');
}

const round = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(3));

function attemptsLine(attempts = []) {
  return attempts.map((a) => `${a.provider} ${a.status}`).join(', ');
}
