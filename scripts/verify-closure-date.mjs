#!/usr/bin/env node
//
// Verifies the one rule that governs `vso:findingClosureDate` in this repository:
//
//     The property records the date on which the oversight authority formally closed the
//     finding, so within the import Web Scripts it is only ever CLEARED (assigned null) or
//     COPIED for a finding this import leaves Closed. Only the closure review in
//     compliance_web may set a new one.
//
// It is a source check, not a behaviour test, because these Rhino Web Scripts have no unit
// harness — and because the rule has already regressed once: `/api/follow-up/import` stamped
// `followUpClosureDate || followUpDate` at declaration, so a finding that was merely
// *pending* review carried a closure date, and the date then survived a rejection and left
// an In Progress finding reading as closed.
//
// Usage: node scripts/verify-closure-date.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const webscriptsDir = join(root, 'webscripts');

// The one place a non-null value may be written, and the guard that must enclose it.
const GATED_COPY_FILE = 'canonical-model-import/import-canonical-models.post.js';
const GATED_COPY_GUARD = /===\s*"Closed"/;

const PROPERTY = 'vso:findingClosureDate';

const CLEAR = /properties\s*\[\s*"vso:findingClosureDate"\s*\]\s*=\s*null\s*;/;
const ASSIGN = /properties\s*\[\s*"vso:findingClosureDate"\s*\]\s*=/;
const COPY = /setDatePropertyIfPresent\s*\(\s*findingNode\s*,\s*"vso:findingClosureDate"/;

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (entry.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

const problems = [];
let clears = 0;
let gatedCopies = 0;

for (const file of walk(webscriptsDir)) {
  const name = relative(webscriptsDir, file);
  const text = readFileSync(file, 'utf8');
  if (!text.includes(PROPERTY)) {
    continue;
  }

  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (!line.includes(PROPERTY)) {
      return;
    }
    const where = `${name}:${index + 1}`;

    if (CLEAR.test(line)) {
      clears += 1;
      return;
    }

    if (ASSIGN.test(line)) {
      problems.push(
        `${where} assigns ${PROPERTY} a value. A declaration or an import must only ever ` +
          `clear it (\`= null\`); the closure review is the only writer of a real date.`,
      );
      return;
    }

    if (COPY.test(line)) {
      if (name !== GATED_COPY_FILE) {
        problems.push(
          `${where} copies a payload's ${PROPERTY}. Only the canonical import may copy it, ` +
            `and only for a finding it leaves Closed.`,
        );
        return;
      }
      // The copy is allowed only inside the `=== "Closed"` branch; look back for the guard,
      // stopping at the closing brace of its block.
      let guarded = false;
      for (let back = index - 1; back >= 0 && back > index - 12; back -= 1) {
        if (GATED_COPY_GUARD.test(lines[back])) {
          guarded = true;
          break;
        }
      }
      if (!guarded) {
        problems.push(
          `${where} copies a payload's ${PROPERTY} outside an \`=== "Closed"\` guard, so a ` +
            `finding that is not closed could acquire a closure date.`,
        );
        return;
      }
      gatedCopies += 1;
    }
  });
}

// A finding must be able to come back from a closure: if nothing in the import Web Scripts
// clears the property, a re-declaration after an approval keeps the superseded date.
if (clears === 0) {
  problems.push(
    `no Web Script clears ${PROPERTY} (\`properties["${PROPERTY}"] = null\`), so a finding ` +
      `whose closure is superseded or rejected would keep the old closure date.`,
  );
}

if (problems.length > 0) {
  console.error(`FAIL: ${problems.length} ${PROPERTY} write(s) violate the closure-date rule:`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error(
    '\nThe rule: the property means "formally closed by the oversight authority", so it is\n' +
      'null unless vso:findingStatus is Closed. Declaring a closure clears it, rejecting one\n' +
      'clears it, and only the closure review (compliance_web) writes a real date.',
  );
  process.exit(1);
}

console.log(
  `OK: ${PROPERTY} honoured — ${clears} clear(s), ${gatedCopies} guarded copy(ies), no unguarded write`,
);
