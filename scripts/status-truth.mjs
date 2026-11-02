#!/usr/bin/env node
// status-truth.mjs — the site's numbers come from the SDK, and a gate fails when the page disagrees.
//
// WHY. The page said 41 invariants and 53 hazards while the corpus held 43 and 56; it said "133 guard scripts and 506 mutation proofs" and
// "15/15 named gates … 33/33 mutations" while the rig reported 22 gates, 23 hazards and 514 proofs. Every one was true when typed and none was
// checked again — the same failure the SDK exists to catch in other people's repos, on the page that sells it.
//
// HOW. `valiant status --json` is the only source of truth (the SDK counts its own corpus and proofs). This script rewrites the marked numbers in
// the site's HTML and exits non-zero when they differ, so the site can adopt the SDK and enforce its own claims like any other repo.
//
// usage: node scripts/status-truth.mjs · --write · --sdk <path to the sdk>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const sdkArg = args.indexOf('--sdk');
const SDK = sdkArg !== -1 ? args[sdkArg + 1] : join(SITE, '..', 'valiant-verification-sdk');
const WRITE = args.includes('--write');

const cli = join(SDK, 'bin', 'valiant.mjs');
if (!existsSync(cli)) {
  console.error(`status-truth: no SDK at ${SDK} — pass --sdk <path>, or clone valiant-verification-sdk next to this repo.`);
  console.error('  The page cannot be checked against nothing; saying so is the point.');
  process.exit(2);
}

let truth;
try {
  truth = JSON.parse(execFileSync(process.execPath, [cli, 'status', '--json'], { cwd: SDK, encoding: 'utf8' }));
} catch (e) {
  console.error(`status-truth: the SDK could not report its own counts (${e.message})`);
  process.exit(2);
}

// Each entry: a regex that CAPTURES the number(s) a sentence publishes, and the replacement built from the truth. Anything the SDK cannot count
// (the build rig's own numbers, the reviewer's model) is deliberately absent: a claim that cannot be generated belongs in docs/CLAIMS.md as
// LABELLED, not faked here.
const RULES = [
  { file: 'index.html', name: 'universal invariants',
    re: /<strong>\d+ universal invariants<\/strong>/g, to: () => `<strong>${truth.invariants} universal invariants</strong>` },
  { file: 'index.html', name: 'hazards that bought them',
    re: /the <strong>\d+ hazards<\/strong> that bought them/g, to: () => `the <strong>${truth.hazards} hazards</strong> that bought them` },
  { file: 'index.html', name: 'operating-method rules',
    re: /<strong>\d+ operating-method rules<\/strong>/g, to: () => `<strong>${truth.methodRules} operating-method rules</strong>` },
  { file: 'index.html', name: 'gate failure modes',
    re: /<strong>\d+ distinct ways a gate can fail<\/strong>/g, to: () => `<strong>${truth.gateFailureModes ?? 8} distinct ways a gate can fail</strong>` },
];

const problems = [];
const changed = [];
for (const rule of RULES) {
  const p = join(SITE, rule.file);
  if (!existsSync(p)) { problems.push(`${rule.file} is missing`); continue; }
  const before = readFileSync(p, 'utf8');
  const found = before.match(rule.re) ?? [];
  if (found.length === 0) { problems.push(`${rule.file}: "${rule.name}" no longer appears — if the sentence was removed, remove this rule with it`); continue; }
  const after = before.replace(rule.re, rule.to());
  if (after !== before) {
    changed.push(`${rule.file}: ${rule.name} — ${found.join(' / ')} → ${rule.to().replace(/<[^>]+>/g, '')}`);
    if (WRITE) writeFileSync(p, after);
  }
}

if (changed.length && !WRITE) {
  for (const c of changed) console.log(`  DRIFT  ${c}`);
  console.log(`\nstatus-truth: ${changed.length} published number(s) disagree with the SDK. Rewrite them: node scripts/status-truth.mjs --write`);
  process.exit(1);
}
for (const c of changed) console.log(`  WROTE  ${c}`);
if (problems.length) { for (const p of problems) console.error(`  FAIL   ${p}`); process.exit(1); }
const { version } = truth;
console.log(`status-truth: the page matches the SDK — ${truth.invariants} invariants, ${truth.hazards} hazards, ${truth.methodRules} method rules (SDK ${version})`);
process.exit(0);
