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

function sectionText(heading) {
  const start = readme.indexOf(heading);
  if (start === -1) {
    console.error(`FAIL: no "${heading}" section found in README.md`);
    process.exit(1);
  }
  const end = readme.indexOf('\n## ', start + 1);
  return end === -1 ? readme.slice(start) : readme.slice(start, end);
}

// The Mini API reference is a table ("| `POST /api/x` | ... |"); the glance list is a
// bullet list ("- `POST /api/x`: ..."). Each section is parsed separately, so an endpoint
// documented in both is expected rather than a duplicate.
const tableRowPattern = /^\s*\|\s*`?(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+?)`?\s*\|/gmi;
const glanceRowPattern = /^\s*-\s*`?(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+?)`?\s*:/gmi;

function documentedEndpoints(section, pattern) {
  const found = new Map();
  for (const match of section.matchAll(pattern)) {
    const endpoint = `${match[1].toUpperCase()} ${match[2]}`;
    found.set(endpoint, (found.get(endpoint) ?? 0) + 1);
  }
  return found;
}

const sections = [
  {
    label: 'Mini API reference table',
    documented: documentedEndpoints(sectionText('## Mini API reference'), tableRowPattern),
  },
  {
    label: 'API endpoints at a glance list',
    documented: documentedEndpoints(sectionText('## API endpoints at a glance'), glanceRowPattern),
  },
];

const problems = [];

for (const { label, documented } of sections) {
  for (const endpoint of actual) {
    if (!documented.has(endpoint)) {
      problems.push(`${label} is missing a Web Script: ${endpoint}`);
    }
  }

  for (const [endpoint, count] of documented) {
    if (!actual.has(endpoint)) {
      problems.push(`${label} documents a Web Script that does not exist: ${endpoint}`);
    } else if (count > 1) {
      problems.push(`${label} documents the same Web Script ${count} times: ${endpoint}`);
    }
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

console.log(
  `OK: README endpoint manifest matches webscripts/ — ${actual.size} Web Script endpoints documented in both the glance list and the reference table`,
);
