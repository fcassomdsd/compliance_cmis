#!/usr/bin/env node
//
// Verifies that the README's "Mini API reference" table matches the Web Script
// descriptors actually registered in webscripts/. Every *.desc.xml is a real
// endpoint, and its HTTP method comes from the filename (.get/.post/.put/...).
//
// Without this, the endpoint table can silently miss new Web Scripts (it has:
// the provider-history, ce-evidence and direct-tag Web Scripts were absent).
//
// Usage: node scripts/verify-endpoints.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const webscriptsDir = join(root, 'webscripts');
const readmePath = join(root, 'README.md');

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const methodRe = /\.(get|post|put|patch|delete)\.desc\.xml$/;

const actual = new Set();

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    const methodMatch = entry.match(methodRe);
    if (!methodMatch) {
      continue;
    }
    const method = methodMatch[1].toUpperCase();
    const text = readFileSync(full, 'utf8');
    const urlMatch = text.match(/<url>\s*([^<\s][^<]*?)\s*<\/url>/);
    if (!urlMatch) {
      console.error(`FAIL: no <url> in ${full}`);
      process.exit(1);
    }
    actual.add(`${method} ${urlMatch[1]}`);
  }
}

walk(webscriptsDir);

const readme = readFileSync(readmePath, 'utf8');

const sectionStart = readme.indexOf('## Mini API reference');
if (sectionStart === -1) {
  console.error('FAIL: no "## Mini API reference" section found in README.md');
  process.exit(1);
}
const sectionEnd = readme.indexOf('\n## ', sectionStart + 1);
const section = sectionEnd === -1 ? readme.slice(sectionStart) : readme.slice(sectionStart, sectionEnd);

// Endpoint cells look like: | `POST /api/inspection/generate` | ...
const rowPattern = /^\s*\|\s*`?(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+?)`?\s*\|/gmi;

const documented = new Map();
for (const match of section.matchAll(rowPattern)) {
  const endpoint = `${match[1].toUpperCase()} ${match[2]}`;
  documented.set(endpoint, (documented.get(endpoint) ?? 0) + 1);
}

const problems = [];

for (const endpoint of actual) {
  if (!documented.has(endpoint)) {
    problems.push(`Web Script exists but is missing from the README API reference: ${endpoint}`);
  }
}

for (const [endpoint, count] of documented) {
  if (!actual.has(endpoint)) {
    problems.push(`README documents a Web Script that does not exist: ${endpoint}`);
  } else if (count > 1) {
    problems.push(`README documents the same Web Script ${count} times: ${endpoint}`);
  }
}

if (problems.length > 0) {
  console.error(`FAIL: ${problems.length} endpoint manifest drift(s):`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error(`\nActual Web Script endpoints (${actual.size}):`);
  for (const endpoint of [...actual].sort()) {
    console.error(`  ${endpoint}`);
  }
  process.exit(1);
}

console.log(`OK: README API reference matches webscripts/ — ${actual.size} Web Script endpoints documented`);
