#!/usr/bin/env node
// feed-truth.mjs — the corpus feed the page sells must verify, be current, and carry the corpus the SDK ships.
//
// WHY. The page has said "the corpus arrives as a signed, dated feed, so it grows after the sale" since October. A feed did exist: signed with the
// RETIRED key, dated 2026-10-26, carrying 41 invariants while the corpus held 43. It verified, so nothing complained — a stale artefact that passes
// its own check is the quietest kind of wrong.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const sdkArg = args.indexOf('--sdk');
const SDK = sdkArg !== -1 ? args[sdkArg + 1] : join(SITE, '..', 'valiant-verification-sdk');
const MAX_AGE_DAYS = 90;   // a feed older than this has stopped growing, which is what it exists to do

const feedPath = join(SITE, 'corpus', 'current.txt');
if (!existsSync(feedPath)) { console.error('feed-truth: corpus/current.txt is missing — the page sells a feed that is not there'); process.exit(2); }
const token = readFileSync(feedPath, 'utf8').trim();

const mod = await import(join(SDK, 'src', 'corpus-feed.mjs'));
const keyring = {};
const keysDir = join(SDK, 'licence-keys');
for (const f of readdirSync(keysDir)) {
  if (f.endsWith('.pem')) keyring[f.replace(/\.pem$/, '')] = readFileSync(join(keysDir, f), 'utf8');
}
const legacy = join(SDK, 'licence-public.pem');
const ok = mod.verifyCorpusFeed(token, { keyring, publicKeyPem: existsSync(legacy) ? readFileSync(legacy, 'utf8') : undefined });
if (!ok.ok) { console.error(`feed-truth: the published feed does NOT verify — ${ok.reason}`); process.exit(1); }

const truth = JSON.parse(execFileSync(process.execPath, [join(SDK, 'bin', 'valiant.mjs'), 'status', '--json'], { cwd: SDK, encoding: 'utf8' }));
const problems = [];
if (ok.corpus.invariants.length !== truth.invariants) problems.push(`the feed carries ${ok.corpus.invariants.length} invariants, the corpus has ${truth.invariants}`);
if (ok.corpus.hazards.length !== truth.hazards) problems.push(`the feed carries ${ok.corpus.hazards.length} hazards, the corpus has ${truth.hazards}`);
if (ok.corpus.method.length !== truth.methodRules) problems.push(`the feed carries ${ok.corpus.method.length} method rules, the corpus has ${truth.methodRules}`);
const ageDays = Math.floor((Date.now() - Date.parse(ok.version)) / 86400000);
if (!Number.isFinite(ageDays)) problems.push(`the feed's version "${ok.version}" is not a date, so its age cannot be judged`);
else if (ageDays > MAX_AGE_DAYS) problems.push(`the feed is ${ageDays} days old — it stopped growing, which is the one thing it exists to do`);
const retired = ok.corpus.kid !== 'vvs-2026-11';
if (retired) problems.push(`the feed is signed with ${ok.corpus.kid}, which is retired — re-sign it: valiant corpus --publish --out corpus/current.txt`);

if (problems.length) { for (const p of problems) console.error(`  FAIL  ${p}`); process.exit(1); }
console.log(`feed-truth: the feed verifies (kid ${ok.corpus.kid}, ${ok.version}, ${ageDays}d old) and carries the corpus the SDK ships`);
process.exit(0);
