#!/usr/bin/env node
// Mosaic data CLI. Zero dependencies, Node 20+.
//
//   node data/cli.mjs pack --ticker MSFT [--session <dir>]
//   node data/cli.mjs pack --macro [--session <dir>]
//   node data/cli.mjs pack --portfolio holdings.json [--session <dir>]
//   node data/cli.mjs check-provider <id> [--symbol AAPL] [--series ust_10y]
//   node data/cli.mjs setup [--user-agent "Your Name you@example.com"] [--status]
//   node data/cli.mjs providers
//   node data/cli.mjs paths
//
// Common options: --home <dir> (Mosaic home), --plugin-data <dir>, --no-cache, --verbose.
// Keys come from environment variables or <home>/.env.local and are never printed.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { parseArgs } from './lib/args.mjs';
import { paths as resolvePaths } from './lib/paths.mjs';
import { loadConfig, loadSeries } from './lib/config.mjs';
import { createEnv, writeEnvValue } from './lib/env.mjs';
import { loadAdapters } from './providers/index.mjs';
import { createRouter } from './router.mjs';
import { buildPack } from './packs/build.mjs';
import { renderPackMarkdown } from './packs/render.mjs';
import { readHoldings } from './packs/portfolio.mjs';
import { checkProvider } from './lib/contract-test.mjs';

const HELP = `Mosaic data CLI

  pack --ticker <SYMBOL> | --macro | --portfolio <holdings.json>   build a data pack
       [--session <dir>]  write data-pack.json and data-pack.md there (default: print a summary)
  check-provider <id> [--symbol AAPL] [--series <canonical id>]   contract-test one adapter
  setup [--user-agent "Name email"] [--status]                       store the SEC User-Agent, show key status
  providers                                                          list providers and whether keys are set
  paths                                                              print where sessions, journal and cache live

Options: --home <dir>  --plugin-data <dir>  --no-cache  --verbose`;

export async function context(args, { fetchImpl, now, clock, sleep } = {}) {
  const p = resolvePaths({ home: args.home, pluginData: args.pluginData });
  const config = loadConfig({ userConfigPath: p.userConfig });
  if (args.noCache) config.cache.enabled = false;
  const env = createEnv({ files: [p.envFile] });
  const { adapters, problems } = await loadAdapters(config);
  const log = args.verbose ? (e) => process.stderr.write(`[http] ${JSON.stringify(e)}\n`) : () => {};
  const router = createRouter({ config, adapters, env, series: loadSeries(), fetchImpl, cacheDir: p.cache, now, clock, sleep, log });
  return { p, config, env, adapters, problems, router };
}

async function cmdPack(args, inject) {
  const kind = args.ticker ? 'ticker' : args.macro ? 'macro' : args.portfolio ? 'portfolio' : null;
  if (!kind) throw usage('pack needs --ticker <SYMBOL>, --macro, or --portfolio <file>');
  if (kind === 'ticker' && (args.ticker === true || !/^[A-Za-z0-9.\-]{1,12}$/.test(args.ticker))) throw usage('--ticker needs a symbol like MSFT');
  const ctx = await context(args, inject);
  warnProblems(ctx.problems);
  const holdings = kind === 'portfolio' ? readHoldings(path.resolve(args.portfolio)) : undefined;
  if (kind !== 'macro' && !ctx.env.get(ctx.config.providers['sec-edgar']?.userAgentEnv || 'MOSAIC_SEC_USER_AGENT')) {
    process.stderr.write('Note: no SEC User-Agent set, so EDGAR is skipped. Run: node data/cli.mjs setup\n');
  }
  const pack = await buildPack({ kind, router: ctx.router, config: ctx.config, series: loadSeries(), symbol: kind === 'ticker' ? args.ticker.toUpperCase() : undefined, holdings, ...(inject.now ? { now: inject.now } : {}) });
  if (args.session && args.session !== true) {
    const dir = path.resolve(args.session);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'data-pack.json'), JSON.stringify(pack, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, 'data-pack.md'), renderPackMarkdown(pack));
    console.log(`Wrote ${path.join(dir, 'data-pack.json')} and data-pack.md`);
  }
  console.log(summary(pack));
  return pack.coverage.score > 0 ? 0 : 2;
}

function summary(pack) {
  const lines = [`${pack.kind} pack${pack.symbol ? ` for ${pack.symbol}` : ''}: ${pack.facts.length} facts, ${pack.coverage.missingFacts} missing, coverage ${Math.round(pack.coverage.score * 100)}%, ${pack.hash}`];
  for (const [cap, st] of Object.entries(pack.coverage.byCapability)) lines.push(`  ${cap.padEnd(14)} ${st}`);
  for (const w of pack.warnings) lines.push(`  warning: ${w}`);
  return lines.join('\n');
}

async function cmdCheckProvider(args, inject) {
  const id = args._[1];
  if (!id) throw usage('check-provider needs a provider id');
  const ctx = await context({ ...args, noCache: true }, inject);
  warnProblems(ctx.problems);
  const adapter = ctx.adapters.get(id);
  if (!adapter) throw usage(`no provider "${id}". Known: ${[...ctx.adapters.keys()].join(', ')}`);
  const report = await checkProvider(adapter, { router: ctx.router, symbol: args.symbol || 'AAPL', series: typeof args.series === 'string' ? args.series : undefined, seriesMap: loadSeries() });
  if (report.problems.length) {
    console.log(`${id}: adapter shape FAILED\n  ${report.problems.join('\n  ')}`);
    return 1;
  }
  console.log(`${id} (${adapter.name})`);
  for (const r of report.results) console.log(`  ${r.result.toUpperCase().padEnd(7)} ${r.capability.padEnd(14)} ${r.detail}`);
  return report.results.some((r) => r.result === 'fail') ? 1 : 0;
}

async function cmdSetup(args) {
  const p = resolvePaths({ home: args.home, pluginData: args.pluginData });
  const config = loadConfig({ userConfigPath: p.userConfig });
  const uaEnv = config.providers['sec-edgar']?.userAgentEnv || 'MOSAIC_SEC_USER_AGENT';
  if (args.status) return status(p, config);
  let ua = typeof args.userAgent === 'string' ? args.userAgent : '';
  if (!ua && process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    ua = await rl.question('The SEC asks every client to identify itself. Enter your name and email (e.g. "Jane Doe jane@example.com"): ');
    rl.close();
  }
  ua = String(ua).trim();
  if (!/\S+@\S+\.\S+/.test(ua)) throw usage('the SEC User-Agent must include a contact email, e.g. --user-agent "Jane Doe jane@example.com"');
  fs.mkdirSync(p.home, { recursive: true });
  writeEnvValue(p.envFile, uaEnv, ua.startsWith('Mosaic') ? ua : `Mosaic/0.1 ${ua}`);
  ensureGitignore(p.home);
  console.log(`Saved ${uaEnv} to ${p.envFile} (git-ignored). EDGAR is ready.`);
  return 0;
}

function status(p, config) {
  const env = createEnv({ files: [p.envFile] });
  console.log(`Mosaic home: ${p.home}\nSettings file: ${p.envFile}${fs.existsSync(p.envFile) ? '' : ' (not created yet)'}`);
  const uaEnv = config.providers['sec-edgar']?.userAgentEnv || 'MOSAIC_SEC_USER_AGENT';
  console.log(`  ${uaEnv.padEnd(24)} ${env.has(uaEnv) ? 'set' : 'not set (run setup)'}`);
  for (const [id, c] of Object.entries(config.providers)) if (c.keyEnv) console.log(`  ${c.keyEnv.padEnd(24)} ${env.has(c.keyEnv) ? 'set' : 'not set'}  (${id})`);
  return 0;
}

function ensureGitignore(home) {
  const gi = path.join(home, '.gitignore');
  if (!fs.existsSync(path.join(home, '.git'))) return;
  const text = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  if (!/^\.env\.local$/m.test(text) && !/^\.env\*$/m.test(text)) fs.appendFileSync(gi, `${text.endsWith('\n') || !text ? '' : '\n'}.env.local\n`);
}

async function cmdProviders(args, inject) {
  const ctx = await context(args, inject);
  warnProblems(ctx.problems);
  for (const a of ctx.adapters.values()) {
    const keyState = a.needsKey ? (ctx.router.keyFor(a.id) ? 'key set' : `needs ${ctx.config.providers[a.id]?.keyEnv || a.keyEnv}`) : 'no key needed';
    console.log(`${a.id.padEnd(10)} ${keyState.padEnd(26)} ${a.capabilities.join(', ')}`);
  }
  console.log('\nChains (first answer wins):');
  for (const [cap, chain] of Object.entries(ctx.config.chains)) console.log(`  ${cap.padEnd(14)} ${chain.join(' > ')}`);
  return 0;
}

function cmdPaths(args) {
  console.log(JSON.stringify(resolvePaths({ home: args.home, pluginData: args.pluginData }), null, 2));
  return 0;
}

function warnProblems(problems) {
  for (const p of problems) process.stderr.write(`warning: ${p}\n`);
}

function usage(msg) {
  const e = new Error(msg);
  e.usage = true;
  return e;
}

/**
 * @param {string[]} argv
 * @param {{ fetchImpl?: typeof fetch, now?: () => number, clock?: () => number, sleep?: (ms: number) => Promise<void> }} [inject] test seams
 */
export async function main(argv, inject = {}) {
  const args = parseArgs(argv, { booleans: ['macro', 'noCache', 'verbose', 'status', 'help'] });
  const cmd = args._[0];
  try {
    if (!cmd || args.help) {
      console.log(HELP);
      return cmd ? 0 : 1;
    }
    if (cmd === 'pack') return await cmdPack(args, inject);
    if (cmd === 'check-provider') return await cmdCheckProvider(args, inject);
    if (cmd === 'setup') return await cmdSetup(args);
    if (cmd === 'providers') return await cmdProviders(args, inject);
    if (cmd === 'paths') return cmdPaths(args);
    throw usage(`unknown command "${cmd}"`);
  } catch (err) {
    process.stderr.write(`${err.usage ? 'usage' : 'error'}: ${err.message}\n`);
    if (err.usage) process.stderr.write(`\n${HELP}\n`);
    return err.usage ? 64 : 1;
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invoked) main(process.argv.slice(2)).then((code) => process.exit(code));
