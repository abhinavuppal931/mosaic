// Mosaic data CLI. Zero dependencies, Node 20+.
//
//   node data/cli.mjs pack --ticker MSFT [--session <dir>]
//   node data/cli.mjs pack --macro [--session <dir>]
//   node data/cli.mjs pack --portfolio holdings.json [--session <dir>]
//   node data/cli.mjs check-provider <id> [--symbol AAPL] [--series ust_10y]
//   node data/cli.mjs setup [--status]   (--status starts with the first-run check)
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
import { loadConfig, loadSeries, writeUserConfigValue } from './lib/config.mjs';
import { createEnv } from './lib/env.mjs';
import { loadAdapters } from './providers/index.mjs';
import { createRouter } from './router.mjs';
import { buildPack } from './packs/build.mjs';
import { renderPackMarkdown } from './packs/render.mjs';
import { readHoldings } from './packs/portfolio.mjs';
import { checkProvider } from './lib/contract-test.mjs';
import { isMain } from './lib/entry.mjs';
import { redactText } from './lib/redact.mjs';

const HELP = `Mosaic data CLI

  pack --ticker <SYMBOL> | --macro | --portfolio <holdings.json>   build a data pack
       [--session <dir>]  write data-pack.json and data-pack.md there (default: print a summary)
  check-provider <id> [--symbol AAPL] [--series <canonical id>]   contract-test one adapter
  setup [--status]                                                   ask for and store your SEC contact; --status runs the
                                                                     first-run check (Node, home folder, SEC contact) and shows
                                                                     which keys are set
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
  if (kind !== 'macro' && !contactSource(ctx.config, ctx.env)) {
    process.stderr.write(`Note: no SEC contact set, so EDGAR is skipped. Set MOSAIC_SEC_CONTACT or run: node ${quotePath(path.join(ctx.p.pluginRoot, 'data', 'cli.mjs'))} setup\n`);
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

const CONTACT_PATH = ['providers', 'sec-edgar', 'contact'];
const CONTACT_PROMPT = 'The SEC asks every client to identify itself. Your name and email (e.g. "Jane Doe jane@example.com"): ';

/** Where the SEC contact is set: 'env', 'config' or null. Never returns the value. */
function contactSource(config, env) {
  const c = config.providers['sec-edgar'] || {};
  if (c.contactEnv && env.get(c.contactEnv)) return 'env';
  if (c.contact) return 'config';
  return null;
}

/**
 * Store the SEC contact. It is never read from the command line (argv lands in shell
 * history and process lists): `setup` asks on the terminal and writes it to the user's
 * mosaic.config.json; or the user sets MOSAIC_SEC_CONTACT themselves.
 */
async function cmdSetup(args, inject) {
  const p = resolvePaths({ home: args.home, pluginData: args.pluginData });
  const config = loadConfig({ userConfigPath: p.userConfig });
  const contactEnv = config.providers['sec-edgar']?.contactEnv || 'MOSAIC_SEC_CONTACT';
  if (args.status) return status(p, config);
  if (args.userAgent || args.contact) throw usage('setup does not take your name or email as an argument; run it in a terminal and it will ask, or set ' + contactEnv);
  const ask = inject.prompt || (process.stdin.isTTY ? askTerminal : null);
  if (!ask) {
    console.log(`No terminal to ask on. Set ${contactEnv}="Your Name you@example.com" in your environment or in ${p.envFile}, or add "providers": { "sec-edgar": { "contact": "Your Name you@example.com" } } to ${p.userConfig}.`);
    return 1;
  }
  const contact = String((await ask(CONTACT_PROMPT)) || '').replace(/[\r\n]/g, ' ').trim();
  if (!/\S+@\S+\.\S+/.test(contact)) throw usage('the SEC contact must include an email address, e.g. "Jane Doe jane@example.com"');
  writeUserConfigValue(p.userConfig, CONTACT_PATH, contact);
  ensureGitignore(p.home);
  console.log(`Saved your SEC contact to ${p.userConfig} (git-ignored, readable only by you). EDGAR is ready.`);
  return 0;
}

async function askTerminal(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

export const MIN_NODE = 20;

/** A path in plain double quotes for a copy-paste hint. Unlike JSON.stringify it does not double Windows backslashes. */
export function quotePath(p) {
  return `"${p}"`;
}

/**
 * The first-run check /mosaic runs before intake: Node version, a writable Mosaic home, and the
 * SEC contact. Each failed item carries one next step. Never reads or returns a secret value.
 * @returns {{ ready: boolean, items: { name: string, ok: boolean, detail: string, next?: string }[] }}
 */
export function firstRunCheck(p, config, env, { nodeVersion = process.versions.node } = {}) {
  const items = [];
  const major = Number(String(nodeVersion).split('.')[0]);
  items.push(major >= MIN_NODE
    ? { name: 'Node.js', ok: true, detail: `${nodeVersion}` }
    : { name: 'Node.js', ok: false, detail: `${nodeVersion} is too old`, next: `Install Node.js ${MIN_NODE} or later from https://nodejs.org, then run /mosaic again.` });
  const probe = path.join(p.home, `.write-check-${process.pid}`);
  try {
    fs.mkdirSync(p.home, { recursive: true });
    fs.writeFileSync(probe, '');
    fs.rmSync(probe, { force: true });
    items.push({ name: 'Mosaic home', ok: true, detail: `${p.home} (writable)` });
  } catch (e) {
    items.push({ name: 'Mosaic home', ok: false, detail: `${p.home} is not writable (${e.code || e.message})`, next: 'Set MOSAIC_HOME to a folder you can write to (for example a "mosaic" folder in your Documents), then run /mosaic again.' });
  }
  const src = contactSource(config, env);
  const cli = quotePath(path.join(p.pluginRoot, 'data', 'cli.mjs'));
  items.push(src
    ? { name: 'SEC contact', ok: true, detail: src === 'env' ? `set (${config.providers['sec-edgar'].contactEnv})` : 'set (user config)' }
    : { name: 'SEC contact', ok: false, detail: 'not set; company filings are skipped until it is (macro questions work without it)', next: `Let /mosaic ask for your name and email now, or run node ${cli} setup in a terminal.` });
  return { ready: items.every((i) => i.ok), items };
}

function status(p, config) {
  const env = createEnv({ files: [p.envFile] });
  const check = firstRunCheck(p, config, env);
  console.log('First-run check');
  for (const i of check.items) {
    console.log(`  ${i.name.padEnd(24)} ${i.ok ? 'ok' : 'FIX'}  ${i.detail}`);
    if (i.next) console.log(`  ${''.padEnd(24)} next step: ${i.next}`);
  }
  const fix = check.items.filter((i) => !i.ok).length;
  console.log(check.ready ? 'Ready.' : `${fix === 1 ? 'One item' : `${fix} items`} to fix before a council.`);
  console.log(`\nMosaic home: ${p.home}\nKeys file: ${p.envFile}${fs.existsSync(p.envFile) ? '' : ' (not created yet)'}\nUser config: ${p.userConfig}${fs.existsSync(p.userConfig) ? '' : ' (not created yet)'}`);
  for (const [id, c] of Object.entries(config.providers)) if (c.keyEnv) console.log(`  ${c.keyEnv.padEnd(24)} ${env.has(c.keyEnv) ? 'set' : 'not set'}  (${id})`);
  return check.ready ? 0 : 3;
}

function ensureGitignore(home) {
  const gi = path.join(home, '.gitignore');
  if (!fs.existsSync(path.join(home, '.git'))) return;
  const text = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  const need = ['.env.local', '/mosaic.config.json'].filter((line) => !new RegExp(`^${line.replace(/[.*/]/g, '\\$&')}$`, 'm').test(text));
  if (need.length) fs.appendFileSync(gi, `${text.endsWith('\n') || !text ? '' : '\n'}${need.join('\n')}\n`);
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
 * @param {{ fetchImpl?: typeof fetch, now?: () => number, clock?: () => number, sleep?: (ms: number) => Promise<void>, prompt?: (q: string) => Promise<string> }} [inject] test seams
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
    if (cmd === 'setup') return await cmdSetup(args, inject);
    if (cmd === 'providers') return await cmdProviders(args, inject);
    if (cmd === 'paths') return cmdPaths(args);
    throw usage(`unknown command "${cmd}"`);
  } catch (err) {
    process.stderr.write(`${err.usage ? 'usage' : 'error'}: ${redactText(err.message)}\n`);
    if (err.usage) process.stderr.write(`\n${HELP}\n`);
    return err.usage ? 64 : 1;
  }
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((code) => process.exit(code));
