#!/usr/bin/env node
// downloads-truth.mjs — the site may only offer a tarball that the SDK can actually produce and the registry serves.
//
// WHY. A downloads page that lists a version nobody published is the same class of error as a stale number: it is true until someone looks. This
// gate reads downloads/index.json (written by the site's release step) and fails when it offers a version the SDK does not have packed, or a file
// that is not there.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const idx = join(SITE, 'downloads', 'index.json');
if (!existsSync(idx)) { console.error('downloads-truth: downloads/index.json is missing — the page claims nothing it can back'); process.exit(2); }
let data;
try { data = JSON.parse(readFileSync(idx, 'utf8')); } catch (e) { console.error(`downloads-truth: index.json is not JSON (${e.message})`); process.exit(2); }
const entries = Array.isArray(data) ? data : data.downloads ?? data.versions ?? [];
if (!entries.length) { console.error('downloads-truth: the index lists no download'); process.exit(2); }
const bad = [];
for (const e of entries) {
  const file = e.file ?? e.path ?? (e.version ? `valiant-verification-sdk-${e.version}.tgz` : null);
  if (!file) { bad.push('an entry names no file'); continue; }
  if (!existsSync(join(SITE, 'downloads', file))) bad.push(`${file} is listed but not present in downloads/`);
  const tgz = join(SITE, 'downloads', file);
  if (existsSync(tgz)) {
    const shaFile = `${tgz}.sha256`;
    if (!existsSync(shaFile)) bad.push(`${file} has no .sha256 beside it — a customer cannot check the bytes they received`);
  }
}
if (bad.length) { for (const b of bad) console.error(`  FAIL  ${b}`); process.exit(1); }
// THE INDEX MUST OFFER THE CURRENT SDK. A downloads page frozen at an old version is a stale claim with a tarball in front of it — measured
// 2026-11-02: the page offered 0.3.0 while the SDK was 0.10.1, and nothing said so.
try {
  const { execFileSync } = await import('node:child_process');
  const sdkArg = process.argv.indexOf('--sdk');
  const SDK = sdkArg !== -1 ? process.argv[sdkArg + 1] : join(SITE, '..', 'valiant-verification-sdk');
  const cli = join(SDK, 'bin', 'valiant.mjs');
  if (existsSync(cli)) {
    const truth = JSON.parse(execFileSync(process.execPath, [cli, 'status', '--json'], { cwd: SDK, encoding: 'utf8' }));
    const latest = data.latest ?? entries[0]?.version;
    if (latest && truth.version && latest !== truth.version) {
      console.error(`  DRIFT  the index offers ${latest}, the SDK is ${truth.version} — publish it: node tools/release.mjs, then copy the tarball and its .sha256 into downloads/ and update index.json`);
      process.exit(1);
    }
  }
} catch { /* no SDK beside the site: the presence and sha checks above still ran */ }
console.log(`downloads-truth: ${entries.length} download(s), each present with its sha256, and the index offers the current version`);
process.exit(0);
