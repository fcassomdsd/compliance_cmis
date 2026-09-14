#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez
//
// Domain-rule spec checker.
//
// `domain-rules/nomenclatura.spec.json` is the single source of truth for the
// platform's document identifiers, the severity-to-deadline baseline and the
// follow-up/closure vocabulary. This script:
//
//   1. validates the spec is internally consistent (patterns compile, every
//      vector agrees with the pattern/rule it exercises);
//   2. runs the CMIS Rhino helper (webscripts/common/vso-follow-up.lib.js)
//      against the shared vectors — the webscripts cannot read the spec at
//      runtime, so they are pinned to it here;
//   3. verifies that every consumer repo vendors a byte-identical copy of the
//      spec (only possible from a checkout that contains the sibling repos;
//      CI reports a skip when they are absent).
//
// Usage:
//   node scripts/domain-rules.mjs [verify] [--root DIR]
//   node scripts/domain-rules.mjs sync [--root DIR]
//
//   verify (default)  run steps 1-3, exit 1 on any problem
//   sync              copy the canonical spec into each consumer repo

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const workspaceRoot = path.resolve(repoRoot, '..');
const specPath = path.join(repoRoot, 'domain-rules', 'nomenclatura.spec.json');
const followUpLib = path.join(repoRoot, 'webscripts', 'common', 'vso-follow-up.lib.js');

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('--')) || 'verify';
const rootFlag = args.indexOf('--root');
const root = rootFlag === -1 ? workspaceRoot : path.resolve(args[rootFlag + 1]);

const problems = [];
const notes = [];

function fail(message) {
  problems.push(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function addDays(baseDate, days) {
  const result = new Date(`${baseDate}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + Number(days));
  return result.toISOString().slice(0, 10);
}

// --- 1. Spec internal consistency -----------------------------------------

function validateSpec(spec) {
  if (!spec.version || typeof spec.version !== 'string') {
    fail('spec.version is required');
  }

  const patterns = {};

  for (const [name, definition] of Object.entries(spec.ids)) {
    if (!definition.pattern) {
      fail(`ids.${name}.pattern is missing`);
      continue;
    }

    try {
      patterns[name] = new RegExp(definition.pattern);
    } catch (error) {
      fail(`ids.${name}.pattern does not compile: ${error.message}`);
    }

    const extraPatterns = { input: definition.inputPattern };
    for (const [key, value] of Object.entries(extraPatterns)) {
      if (!value) continue;
      try {
        new RegExp(value);
      } catch (error) {
        fail(`ids.${name}.${key}Pattern does not compile: ${error.message}`);
      }
    }
  }

  for (const vector of spec.conformanceVectors.parse) {
    const pattern = patterns[vector.id];
    if (!pattern) {
      fail(`conformanceVectors.parse references unknown id "${vector.id}"`);
      continue;
    }

    const match = pattern.exec(vector.value);
    if (!match) {
      fail(`parse vector ${vector.id} "${vector.value}" does not match its own pattern`);
      continue;
    }

    const expected = vector.expected;
    const actual = {};
    for (const part of spec.ids[vector.id].parts) {
      const raw = match[spec.ids[vector.id].parts.indexOf(part) + 1];
      actual[part] = /^\d+$/.test(raw) && typeof expected[part] === 'number' ? Number(raw) : raw;
    }

    assertEqual(actual, expected, `parse vector ${vector.id} "${vector.value}"`);
  }

  for (const vector of spec.conformanceVectors.invalid) {
    const pattern = patterns[vector.id];
    if (!pattern) {
      fail(`conformanceVectors.invalid references unknown id "${vector.id}"`);
      continue;
    }

    if (pattern.test(vector.value)) {
      fail(`invalid vector ${vector.id} "${vector.value}" unexpectedly matches the canonical pattern`);
    }
  }

  for (const vector of spec.conformanceVectors.build) {
    const definition = spec.ids[vector.id];
    if (!definition) {
      fail(`conformanceVectors.build references unknown id "${vector.id}"`);
      continue;
    }

    if (!patterns[vector.id].test(vector.expected)) {
      fail(`build vector ${vector.id} "${vector.expected}" does not match the canonical pattern`);
    }

    if (definition.inputPattern && !new RegExp(definition.inputPattern).test(vector.expected)) {
      fail(`build vector ${vector.id} "${vector.expected}" does not match the accepted input pattern`);
    }
  }

  for (const [name, definition] of Object.entries(spec.ids)) {
    if (!definition.example) {
      fail(`ids.${name}.example is missing`);
      continue;
    }

    if (patterns[name] && !patterns[name].test(definition.example)) {
      fail(`ids.${name}.example "${definition.example}" does not match its pattern`);
    }
  }

  for (const vector of spec.conformanceVectors.severity) {
    const level = spec.severity.levels.find((entry) => entry.id === vector.severity);
    if (!level) {
      fail(`severity vector references unknown level "${vector.severity}"`);
      continue;
    }

    assertEqual(level.daysToSolution, vector.daysToSolution, `severity ${vector.severity} daysToSolution`);
    assertEqual(
      addDays(vector.baseDate, vector.daysToSolution),
      vector.resolutionDeadline,
      `severity ${vector.severity} resolution deadline`,
    );
  }

  const canonical = spec.followUpTypes.canonical;
  for (const type of spec.followUpTypes.requiresCorrectiveAction || []) {
    if (!canonical.includes(type)) {
      fail(`followUpTypes.requiresCorrectiveAction entry "${type}" is not a canonical follow-up type`);
    }
  }

  for (const vector of spec.conformanceVectors.followUpTypeNormalization) {
    const aliasTarget = spec.followUpTypes.aliases[vector.input];
    const expected = aliasTarget || (canonical.includes(vector.input) ? vector.input : spec.followUpTypes.default);
    assertEqual(expected, vector.expected, `follow-up type normalization "${vector.input}"`);
  }

  for (const vector of spec.conformanceVectors.closureGate) {
    const closes =
      vector.followUpType === spec.closureGate.requiredFollowUpType &&
      vector.effectivenessConfirmed === spec.closureGate.requiredEffectivenessConfirmed;
    const errors =
      spec.closureGate.rejectsEffectivenessConfirmedWithOtherTypes &&
      vector.effectivenessConfirmed === true &&
      vector.followUpType !== spec.closureGate.requiredFollowUpType;

    assertEqual(closes, vector.shouldClose, `closure gate shouldClose for ${vector.followUpType}`);
    assertEqual(errors, vector.error, `closure gate error for ${vector.followUpType}`);
  }
}

// --- 2. CMIS Rhino helper conformance --------------------------------------

function validateCmisHelpers(spec) {
  if (!fs.existsSync(followUpLib)) {
    fail(`missing ${path.relative(repoRoot, followUpLib)}`);
    return;
  }

  vm.runInThisContext(fs.readFileSync(followUpLib, 'utf8'), { filename: followUpLib });
  const helpers = globalThis.__VSO_FOLLOW_UP_HELPERS;
  if (!helpers) {
    fail('vso-follow-up.lib.js did not export __VSO_FOLLOW_UP_HELPERS');
    return;
  }

  for (const vector of spec.conformanceVectors.build) {
    if (vector.id === 'correctiveAction') {
      assertEqual(
        helpers.buildCorrectiveActionId(vector.input.findingId, vector.input.sequence),
        vector.expected,
        'CMIS buildCorrectiveActionId',
      );
    }

    if (vector.id === 'followUp') {
      assertEqual(
        helpers.buildFollowUpId(vector.input.findingId, vector.input.sequence),
        vector.expected,
        'CMIS buildFollowUpId',
      );
    }
  }

  const followUpVector = spec.conformanceVectors.parse.find((vector) => vector.id === 'followUp');
  if (followUpVector) {
    assertEqual(
      helpers.parseFollowUpSequenceFromId(followUpVector.value, 'H-MDSDA0002-COM-001'),
      followUpVector.expected.followUpSequence,
      'CMIS parseFollowUpSequenceFromId',
    );
  }

  for (const vector of spec.conformanceVectors.closureGate) {
    const result = helpers.validateClosurePolicy(vector.followUpType, vector.effectivenessConfirmed);
    assertEqual(result.shouldClose, vector.shouldClose, `CMIS closure shouldClose for ${vector.followUpType}`);
    assertEqual(Boolean(result.error), vector.error, `CMIS closure error for ${vector.followUpType}`);
  }
}

// --- 3. Cross-repo copy verification ---------------------------------------

function consumerRepos(spec) {
  return (spec.appliesTo || []).filter((repo) => repo !== 'compliance_cmis');
}

function verifyCopies(spec) {
  const consumers = consumerRepos(spec);
  const present = consumers.filter((repo) => fs.existsSync(path.join(root, repo)));

  if (present.length === 0) {
    console.log(`SKIP  sibling check: no consumer repos found under ${root}`);
    console.log('      (run from a workspace checkout, or pass --root DIR, to verify vendored copies)');
    return;
  }

  const canonical = fs.readFileSync(specPath);

  for (const repo of consumers) {
    const repoDir = path.join(root, repo);
    if (!fs.existsSync(repoDir)) {
      console.log(`SKIP  ${repo}: not checked out under ${root}`);
      continue;
    }

    const copy = path.join(repoDir, 'domain-rules', 'nomenclatura.spec.json');
    if (!fs.existsSync(copy)) {
      fail(`${repo}: domain-rules/nomenclatura.spec.json is missing (run 'node scripts/domain-rules.mjs sync')`);
      continue;
    }

    if (!fs.readFileSync(copy).equals(canonical)) {
      fail(`${repo}: vendored spec differs from the canonical copy (run 'node scripts/domain-rules.mjs sync')`);
      continue;
    }

    console.log(`OK    ${repo}: vendored spec matches v${spec.version}`);
  }
}

function syncCopies(spec) {
  const canonical = fs.readFileSync(specPath);

  for (const repo of consumerRepos(spec)) {
    const repoDir = path.join(root, repo);
    if (!fs.existsSync(repoDir)) {
      console.log(`SKIP  ${repo}: not checked out under ${root}`);
      continue;
    }

    const targetDir = path.join(repoDir, 'domain-rules');
    const target = path.join(targetDir, 'nomenclatura.spec.json');
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(target, canonical);
    console.log(`WROTE ${path.relative(root, target)}`);
  }
}

// --- main ------------------------------------------------------------------

if (!fs.existsSync(specPath)) {
  console.error(`FAIL: canonical spec is missing at ${specPath}`);
  process.exit(1);
}

const spec = readJson(specPath);

if (command === 'sync') {
  syncCopies(spec);
  process.exit(0);
}

if (command !== 'verify') {
  console.error(`FAIL: unknown command "${command}" (expected "verify" or "sync")`);
  process.exit(1);
}

validateSpec(spec);
validateCmisHelpers(spec);
verifyCopies(spec);

for (const note of notes) {
  console.log(`NOTE  ${note}`);
}

if (problems.length > 0) {
  console.error('');
  for (const problem of problems) {
    console.error(`FAIL: ${problem}`);
  }
  console.error(`\n${problems.length} domain-rule problem(s) found`);
  process.exit(1);
}

console.log(`\nDomain-rule spec v${spec.version} is consistent and all available copies match.`);
