#!/usr/bin/env node
// checkout-truth.mjs — a buyer who pays is sent to a page that exists, on the origin that serves it.
//
// WHY. Measured 2026-11-05: the buy buttons on vvs.morpheus.nz built their success URL as
// `location.origin + '/claim?session_id=…'`. This site is GitHub Pages; `/claim` is a route of the Morpheus
// app, which lives on morpheus.nz. So the redirect after payment went to
// https://vvs.morpheus.nz/claim — GitHub's "Page not found", 404 — and the licence that had just been paid
// for was never shown. Nothing caught it: no gate read the success URL, and the flow is only walked when
// someone buys. This gate reads it on every run instead.
//
// The rule: a checkout success URL must be ABSOLUTE and on the app origin, because `location.origin` here is
// the marketing site. Relative-to-origin is exactly the defect.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = 'https://morpheus.nz';          // the Morpheus app: it owns /claim and /licences
const PAGE = join(SITE, 'index.html');
if (!existsSync(PAGE)) { console.error('checkout-truth: index.html is missing'); process.exit(2); }
const html = readFileSync(PAGE, 'utf8');

// Every successUrl the page builds, with the expression it is built from.
const expr = /successUrl='\s*\+\s*encodeURIComponent\(([^)]*(?:\)[^)]*)*?)\)/g;
const found = [];
let m;
while ((m = expr.exec(html))) found.push({ at: m.index, expr: m[1].trim() });

const bad = [];
if (!found.length) bad.push('no checkout success URL could be found in index.html — the buy path has moved and this gate cannot see it');

for (const f of found) {
  const e = f.expr;
  if (e.includes('location.origin') || e.includes('location.host')) {
    bad.push(`success URL is built from the page's own origin (${e}) — /claim is a Morpheus route, not a page on this site; ` +
      `the buyer lands on a 404 after paying`);
    continue;
  }
  if (!e.includes(`${APP}/claim`)) {
    bad.push(`success URL (${e}) does not point at ${APP}/claim — that is the page that turns the paid session into a licence`);
  }
}

if (bad.length) {
  for (const b of bad) console.error(`  FAIL  ${b}`);
  console.error('\ncheckout-truth: the paid path must land on a page that exists');
  process.exit(1);
}
console.log(`checkout-truth: ${found.length} success URL(s), all absolute to ${APP}/claim`);
