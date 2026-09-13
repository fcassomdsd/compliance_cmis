#!/usr/bin/env node
//
// Validates the example/ payloads that document the Web Script contracts.
//
// Several endpoints are documented only by their example payload, and those
// examples drifted: process-followups-by-files.sample.json referenced a
// follow-up file that does not exist, and the follow-up example used
// "evidence" where the importer reads "evidenceItems" (so following the
// quick-start silently dropped all evidence). This script keeps them honest.
//
// Usage: node scripts/validate-examples.cjs

const fs = require('fs');
const path = require('path');

const exampleDir = path.join(__dirname, '..', 'example');

if (!fs.existsSync(exampleDir)) {
  console.error('FAIL: example/ directory is missing');
  process.exit(1);
}

const entries = fs.readdirSync(exampleDir);
const available = new Set(entries);
const problems = [];

const jsonFiles = entries.filter((name) => name.endsWith('.json')).sort();

for (const file of jsonFiles) {
  let payload;

  try {
    payload = JSON.parse(fs.readFileSync(path.join(exampleDir, file), 'utf8'));
  } catch (error) {
    problems.push(`${file}: invalid JSON: ${error.message}`);
    continue;
  }

  // Payloads that name other example files must point at files that exist.
  if (Array.isArray(payload.followUpFiles)) {
    for (const name of payload.followUpFiles) {
      if (typeof name !== 'string' || !available.has(name)) {
        problems.push(`${file}: followUpFiles references missing example file "${name}"`);
      }
    }
  }

  // The follow-up importer reads followUpReport.evidenceItems; an "evidence"
  // key is silently ignored.
  if (payload.followUpReport && typeof payload.followUpReport === 'object') {
    const report = payload.followUpReport;
    if (report.evidence !== undefined && report.evidenceItems === undefined) {
      problems.push(`${file}: followUpReport uses "evidence"; the importer reads "evidenceItems"`);
    }
    if (report.evidenceItems !== undefined && !Array.isArray(report.evidenceItems)) {
      problems.push(`${file}: followUpReport.evidenceItems must be an array`);
    }
  }
}

if (problems.length > 0) {
  console.error(`FAIL: ${problems.length} problem(s) in example payloads:`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log(`OK: ${jsonFiles.length} example payloads valid`);
