#!/usr/bin/env node
// adoptions-truth.mjs — the adoption numbers on the page are MEASURED from the repos that carry them, not typed.
//
// WHY. The corpus sentence (43 / 56 / 24 / 8) has been generated since PR #12. Right beside it sat a typed sentence: "133 guard scripts and 506
// mutation proofs on the Morpheus codebase … 15/15 named gates, 13 recorded hazards, 33/33 mutations caught" — every figure stale (Morpheus records
// 514 proofs across 211 distinct files; the rig has 17 gates, 23 hazards, 35 proofs). A hand-typed number cannot drift into a failure.
//
// HOW. `adoptions.json` is the measurement: each figure names the commit it was read at. `--write` re-measures from the local checkouts (or from the
// CHECKED-IN record when a shared checkout is mid-branch) and keeps any repo this machine cannot see. A plain run REFUSES when the page and the
// measurement disagree — that refusal is what the gate calls.
//
// AND IT CHECKS EVERY PLACE THE NUMBERS APPEAR. The first version checked only the sentence, so a table row kept "133 guards, 506 mutation proofs,
// 53 hazards" on the LIVE page while the gate reported PASS. A gate that checks one paragraph is a claim about that paragraph.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURE = join(SITE, 'adoptions.json');
const PAGE = join(SITE, 'index.html');
const WRITE = process.argv.includes('--write');

const MORPHEUS = process.env.MORPHEUS_REPO || join(process.env.HOME ?? '', 'code', 'morpheus-self-hosted');
const RIG = process.env.RIG_REPO || join(process.env.HOME ?? '', 'harness-mesh');

/** Read a file from the working copy, or from the checked-in record when the working copy has none. */
const reader = (repo) => (file) => {
  const full = join(repo, file);
  if (existsSync(full)) { try { return readFileSync(full, 'utf8'); } catch { /* fall through */ } }
  for (const ref of ['origin/main', 'HEAD']) {
    try { return execFileSync('git', ['-C', repo, 'show', `${ref}:${file}`], { encoding: 'utf8' }); } catch { /* next */ }
  }
  return null;
};

/** One repo's figures: recorded proofs, the distinct files they touch, gates, and ledger hazards. */
function measure(repo, label) {
  if (!existsSync(repo)) return null;
  const read = reader(repo);
  const proofsText = read('mutations.json');
  if (!proofsText) return null;
  let doc; try { doc = JSON.parse(proofsText); } catch { return null; }
  const proofs = doc.proofs ?? [];
  const files = new Set(proofs.map((p) => p.file).filter(Boolean));
  let commit = null; try { commit = execFileSync('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
  let gates = null; try { gates = JSON.parse(read('valiant.json')).gates?.length ?? null; } catch { /* no config */ }
  let hazards = null; try { hazards = ((read('KNOWN-HAZARDS.md') ?? '').match(/^##\s+(?:HM|H)?\d+/gm) ?? []).length || null; } catch { /* no ledger */ }
  return { label, proofs: proofs.length, files: files.size, gates, hazards, commit, measuredFrom: repo };
}

const fresh = [measure(MORPHEUS, 'morpheus'), measure(RIG, 'rig')].filter(Boolean);
let doc;
if (WRITE) {
  const prev = existsSync(MEASURE) ? JSON.parse(readFileSync(MEASURE, 'utf8')) : {};
  const keep = (prev.repos ?? []).filter((r) => !fresh.some((f) => f.label === r.label));
  doc = { note: prev.note, at: new Date().toISOString().slice(0, 10), repos: [...fresh, ...keep] };
  writeFileSync(MEASURE, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`adoptions-truth: measured ${doc.repos.map((r) => `${r.label} ${r.files} files / ${r.proofs} proofs`).join(', ')}`);
} else {
  if (!existsSync(MEASURE)) { console.error('adoptions-truth: adoptions.json is missing — the page would be claiming from memory'); process.exit(2); }
  doc = JSON.parse(readFileSync(MEASURE, 'utf8'));
}

const by = Object.fromEntries((doc.repos ?? []).map((r) => [r.label, r]));
const m = by.morpheus, rig = by.rig;
if (!m || !rig) { console.error('adoptions-truth: adoptions.json must measure both morpheus and rig'); process.exit(2); }

const page = readFileSync(PAGE, 'utf8');
const problems = [];
const want = (label, re, expected) => {
  const got = page.match(re);
  if (!got) problems.push(`${label}: the sentence is not on the page any more — nothing would notice it going stale`);
  else if (got[1] !== String(expected)) problems.push(`${label}: the page says ${got[1]}, the measurement says ${expected}`);
};

want('morpheus guard scripts', /<strong>(\d+) guard scripts and \d+ mutation proofs<\/strong>/, m.files);
want('morpheus mutation proofs', /<strong>\d+ guard scripts and (\d+) mutation proofs<\/strong>/, m.proofs);
want('rig gates', /<strong>(\d+)\/\1 named gates<\/strong>/, rig.gates);
want('rig hazards', /<strong>(\d+) recorded hazards<\/strong>/, rig.hazards);
want('rig mutations', /<strong>(\d+)\/\1 mutations caught<\/strong>/, rig.proofs);

// the same numbers in the comparison table, and the corpus figure read from the signed feed the site already serves
want('table row: guard scripts', /<td class="good">(\d+) guards, \d+ mutation proofs, \d+ corpus hazards<\/td>/, m.files);
want('table row: mutation proofs', /<td class="good">\d+ guards, (\d+) mutation proofs, \d+ corpus hazards<\/td>/, m.proofs);
let feedHazards = null;
try {
  const token = readFileSync(join(SITE, 'corpus', 'current.txt'), 'utf8').trim();
  const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  feedHazards = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')).hazards.length;
} catch { feedHazards = null; }
if (feedHazards == null) problems.push('corpus/current.txt could not be read, so the corpus figure in the table cannot be checked');
else want('table row: corpus hazards', /<td class="good">\d+ guards, \d+ mutation proofs, (\d+) corpus hazards<\/td>/, feedHazards);

if (problems.length) {
  for (const p of problems) console.error(`  FAIL  ${p}`);
  console.error('\nadoptions-truth: re-measure with `node scripts/adoptions-truth.mjs --write`, then look at the diff — the number is the claim.');
  process.exit(1);
}
console.log(`adoptions-truth: Morpheus ${m.files} files / ${m.proofs} proofs @ ${m.commit ?? '?'} · rig ${rig.gates} gates / ${rig.hazards} hazards / ${rig.proofs} proofs @ ${rig.commit ?? '?'}`);
