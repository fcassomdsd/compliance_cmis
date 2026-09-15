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

  // import-canonical reads its context from the REQUEST ROOT
  // (validateImportRequest -> requestBody.inspectionCode) and fetches the actual
  // checklist/finding content from the canonical *.json documents itself. A
  // canonical *document* payload ({ "checklist": {...} }) is therefore not a
  // valid request: posting one answers "400 Missing required field:
  // inspectionCode". Nothing checked that, so the two were documented as the
  // endpoint's example payloads for months.
  if (file.startsWith('import-canonical-request')) {
    if (payload.inspectionCode === undefined) {
      problems.push(`${file}: import-canonical reads inspectionCode from the request root; it must be a flat request, not a nested document payload`);
    }
    if (payload.checklist !== undefined || payload.finding !== undefined) {
      problems.push(`${file}: import-canonical request must not wrap its fields in "checklist"/"finding"`);
    }
  }

  // A canonical document payload is what compliance_import writes into Alfresco
  // and import-canonical reads back. Keep the shape honest.
  if (file.startsWith('canonical-') && file.endsWith('-document.sample.json')) {
    const wrapper = file.includes('checklist') ? 'checklist' : 'finding';
    if (payload[wrapper] === undefined || typeof payload[wrapper] !== 'object') {
      problems.push(`${file}: expected a "${wrapper}" object (the stored canonical document payload)`);
    }
  }

  // regulationBreached is a legacy alias: compliance_checklist copies it into
  // requirementBreached and then deletes it before upload
  // (compliance_checklist/electron/ipc/ipcHandles.js), and the model has only
  // vso:requirementBreached. No canonical document should still carry it.
  if (JSON.stringify(payload).includes('"regulationBreached"')) {
    problems.push(`${file}: carries the legacy field "regulationBreached"; the pipeline normalises it to "requirementBreached" before upload`);
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
