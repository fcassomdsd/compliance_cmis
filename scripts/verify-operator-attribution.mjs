#!/usr/bin/env node
//
// Verifies that both follow-up import paths attribute what they write, and that neither can
// record a closure declaration nobody is able to review.
//
// WHY THIS EXISTS
//
// `/api/follow-up/import` dropped four of the six vso:operatorAttribution properties for
// months. Neither function involved was wrong: normalizeRequest carried enteredBy and
// declaredBy, and applyOperatorAttribution wrote all six correctly. The data was lost in the
// SEAM between them -- applyOperatorAttribution is handed the normalized object, so the four
// fields normalizeRequest did not copy were read off a property that did not exist and
// silently skipped. A test of either function alone passes. So every check here that matters
// runs the real functions, in sequence, across that seam.
//
// The second failure was quieter. A Closure Verification payload with no operator identity
// answered `"success": true` and parked the finding in Pending Closure Approval with
// vso:closureRequestedBy null -- which compliance_web's review route then refuses forever
// (409 CLOSURE_DECLARER_UNKNOWN), because separation of duties cannot be shown against an
// unknown declarer. Both paths now refuse the declaration instead of recording it.
//
// HOW IT RUNS RHINO CODE UNDER NODE
//
// These Web Scripts are self-contained top-level scripts for Alfresco's Rhino engine: no
// exports, no module system, and a trailing `try` block that executes on load. They are
// evaluated here inside a function body with the few Rhino root objects stubbed. The trailing
// block throws at its first call into the repository (`people` is not defined), the script's
// own catch swallows it, and because the stubbed `model.json` is already set that catch does
// not call fail() -- so execution falls through and the hoisted declarations are returned.
// Loading is therefore also an assertion: a syntax error, or a new module-level call into the
// repository, fails this script rather than waiting for a deploy.
//
// WHAT IS AND IS NOT PROVEN HERE
//
//   Behaviour, against the real code:  the standalone normalize -> attribute seam, the
//                                      standalone closure guard, both applyOperatorAttribution
//                                      implementations, and model conformance.
//   Source only:                       the canonical path's closure refusal, which lives
//                                      inside a function that needs a live repository (PDF
//                                      rendering, node hierarchy) to call.
//
// Usage: node scripts/verify-operator-attribution.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const STANDALONE = 'webscripts/follow-up-import/import-follow-up-report.post.js';
const CANONICAL = 'webscripts/canonical-model-import/import-canonical-models.post.js';
const MODEL = 'configs/model/vsoModel.xml';

let failures = 0;
let checks = 0;

function check(name, fn) {
  checks += 1;
  try {
    fn();
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${name}\n          ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// --- the Rhino stub -------------------------------------------------------------------

function makeNode(properties) {
  return {
    properties: Object.assign({}, properties),
    aspects: [],
    saves: 0,
    hasAspect(name) {
      return this.aspects.indexOf(name) !== -1;
    },
    addAspect(name) {
      this.aspects.push(name);
    },
    save() {
      this.saves += 1;
    },
  };
}

// Load a Web Script and hand back the declarations named in `wanted`.
function loadWebScript(relativePath, wanted) {
  const source = readFileSync(join(root, relativePath), 'utf8');
  const prelude = `
    var logger = { error: function () {}, warn: function () {}, log: function () {} };
    // Pre-set .json so the script's own catch block takes the "a response already exists"
    // branch and does not call fail(), which would throw out of this evaluation.
    var model = { json: "loaded-by-verifier" };
    var status = {};
    var jsonUtils = { toJSONString: function (value) { return JSON.stringify(value); } };
    var requestbody = null;
  `;
  const epilogue = `; return { ${wanted.map((n) => `${n}: typeof ${n} === "function" ? ${n} : undefined`).join(', ')} };`;

  let exported;
  try {
    // eslint-disable-next-line no-new-func
    exported = new Function(`${prelude}\n${source}\n${epilogue}`)();
  } catch (error) {
    throw new Error(`${relativePath} could not be evaluated: ${error.message}`);
  }

  for (const name of wanted) {
    if (typeof exported[name] !== 'function') {
      throw new Error(`${relativePath} does not declare ${name}() — this verifier is out of date with the Web Script`);
    }
  }
  return exported;
}

// --- the attribution contract ---------------------------------------------------------

// Read the aspect straight out of the model so a property added there and forgotten in a
// writer is caught from the other side too.
function attributionPropertiesFromModel() {
  const xml = readFileSync(join(root, MODEL), 'utf8');
  const aspect = xml.match(/<aspect name="vso:operatorAttribution">([\s\S]*?)<\/aspect>/);
  if (!aspect) {
    throw new Error(`${MODEL} declares no vso:operatorAttribution aspect`);
  }
  const names = [...aspect[1].matchAll(/<property name="(vso:[^"]+)">/g)].map((m) => m[1]);
  if (names.length === 0) {
    throw new Error('vso:operatorAttribution declares no properties');
  }
  return names;
}

const MODEL_PROPERTIES = attributionPropertiesFromModel();

// A payload in the shape compliance_import produces: the app's pre-verification declaredBy
// and inspectorId, plus the four fields the server stamps after verifying the operator.
const FULL_ATTRIBUTION = {
  enteredBy: 'demo.inspector1',
  enteredByDisplayName: 'Demo Inspector One',
  enteredAt: '2026-09-29T10:00:05Z',
  inspectorId: 'inspector-7',
  enteredVia: 'operator-login',
  declaredBy: 'demo.inspector1',
};

function followUpPayload(extra) {
  return {
    schemaVersion: '1.0',
    followUpReport: Object.assign(
      {
        findingId: 'H-ZZZZA0001-ATS-001',
        followUpType: 'Progress Review',
        followUpDate: '2026-09-29T10:00:00.000Z',
        percentComplete: 40,
        effectivenessConfirmed: false,
      },
      extra,
    ),
  };
}

console.log('operator attribution\n');

const standalone = loadWebScript(STANDALONE, [
  'normalizeRequest',
  'applyOperatorAttribution',
  'updateFindingStatusFromFollowUp',
  'trimToNull',
]);
const canonical = loadWebScript(CANONICAL, ['applyOperatorAttribution']);

// 1. The seam. normalizeRequest -> applyOperatorAttribution is where the four fields were
//    lost, so the check has to cross it rather than test either end.
check('standalone: every attribution property survives normalize -> attribute', () => {
  const normalized = standalone.normalizeRequest(followUpPayload(FULL_ATTRIBUTION));
  const node = makeNode();
  standalone.applyOperatorAttribution(node, normalized);

  const missing = MODEL_PROPERTIES.filter((p) => node.properties[p] === undefined || node.properties[p] === null);
  assert(missing.length === 0, `dropped between normalizeRequest and the node: ${missing.join(', ')}`);
});

check('standalone: the values written are the values supplied, not placeholders', () => {
  const normalized = standalone.normalizeRequest(followUpPayload(FULL_ATTRIBUTION));
  const node = makeNode();
  standalone.applyOperatorAttribution(node, normalized);

  assertEqual(node.properties['vso:enteredBy'], FULL_ATTRIBUTION.enteredBy, 'vso:enteredBy');
  assertEqual(node.properties['vso:enteredByDisplayName'], FULL_ATTRIBUTION.enteredByDisplayName, 'vso:enteredByDisplayName');
  assertEqual(node.properties['vso:enteredAt'], FULL_ATTRIBUTION.enteredAt, 'vso:enteredAt');
  assertEqual(node.properties['vso:inspectorId'], FULL_ATTRIBUTION.inspectorId, 'vso:inspectorId');
  assertEqual(node.properties['vso:enteredVia'], FULL_ATTRIBUTION.enteredVia, 'vso:enteredVia');
  assertEqual(node.properties['vso:declaredBy'], FULL_ATTRIBUTION.declaredBy, 'vso:declaredBy');
});

check('standalone: the aspect is applied', () => {
  const normalized = standalone.normalizeRequest(followUpPayload(FULL_ATTRIBUTION));
  const node = makeNode();
  standalone.applyOperatorAttribution(node, normalized);
  assert(node.hasAspect('vso:operatorAttribution'), 'vso:operatorAttribution was not added');
});

// 2. Both paths must write the same property set from the same payload. A field added to one
//    writer and not the other is the divergence this whole item is about.
check('both paths write the same attribution properties from the same payload', () => {
  const normalized = standalone.normalizeRequest(followUpPayload(FULL_ATTRIBUTION));
  const standaloneNode = makeNode();
  const canonicalNode = makeNode();

  standalone.applyOperatorAttribution(standaloneNode, normalized);
  // The canonical path is handed the raw report, which is why it never lost anything.
  canonical.applyOperatorAttribution(canonicalNode, followUpPayload(FULL_ATTRIBUTION).followUpReport);

  const left = Object.keys(standaloneNode.properties).sort();
  const right = Object.keys(canonicalNode.properties).sort();
  assertEqual(left.join(','), right.join(','), 'property sets differ');

  for (const key of left) {
    assertEqual(String(standaloneNode.properties[key]), String(canonicalNode.properties[key]), `${key} differs between paths`);
  }
});

// 3. Model conformance, from both directions.
check('every model property is written, and nothing outside the model is', () => {
  const normalized = standalone.normalizeRequest(followUpPayload(FULL_ATTRIBUTION));
  const node = makeNode();
  standalone.applyOperatorAttribution(node, normalized);

  const written = Object.keys(node.properties).sort();
  const declared = [...MODEL_PROPERTIES].sort();
  assertEqual(written.join(','), declared.join(','),
    'the writer and vso:operatorAttribution disagree about which properties exist');
});

// 4. Absent fields must stay absent rather than becoming empty strings — a blank enteredBy
//    reads as an attributed record with a nameless operator.
check('standalone: absent attribution leaves the properties unset, not blank', () => {
  const normalized = standalone.normalizeRequest(followUpPayload({}));
  const node = makeNode();
  standalone.applyOperatorAttribution(node, normalized);
  assertEqual(Object.keys(node.properties).length, 0, 'properties written for an unattributed payload');
});

// 5. The closure guard.
check('standalone: a closure declaration with no operator identity is refused', () => {
  const normalized = standalone.normalizeRequest(followUpPayload({
    followUpType: 'Closure Verification',
    effectivenessConfirmed: true,
  }));
  const finding = makeNode({ 'vso:findingStatus': 'In Progress' });

  let threw = false;
  try {
    standalone.updateFindingStatusFromFollowUp(finding, normalized);
  } catch (error) {
    threw = true;
  }
  assert(threw, 'an unattributable closure declaration was accepted');
  assertEqual(finding.properties['vso:findingStatus'], 'In Progress', 'the finding was mutated before the refusal');
  assertEqual(finding.saves, 0, 'the finding was saved despite the refusal');
});

check('standalone: a closure declaration with an operator identity records the declarer', () => {
  const normalized = standalone.normalizeRequest(followUpPayload(Object.assign({
    followUpType: 'Closure Verification',
    effectivenessConfirmed: true,
  }, FULL_ATTRIBUTION)));
  const finding = makeNode({
    'vso:findingStatus': 'In Progress',
    // Left behind by a superseded attempt; both must be cleared by a fresh declaration.
    'vso:findingClosureDate': '2026-09-01',
    'vso:closureRejectionReason': 'insufficient evidence',
  });

  const closed = standalone.updateFindingStatusFromFollowUp(finding, normalized);
  assertEqual(closed, true, 'return value');
  assertEqual(finding.properties['vso:findingStatus'], 'Pending Closure Approval', 'vso:findingStatus');
  assertEqual(finding.properties['vso:closureRequestedBy'], FULL_ATTRIBUTION.enteredBy, 'vso:closureRequestedBy');
  assertEqual(finding.properties['vso:findingClosureDate'], null, 'vso:findingClosureDate');
  assertEqual(finding.properties['vso:closureRejectionReason'], null, 'vso:closureRejectionReason');
});

check('standalone: declaredBy alone is enough to declare a closure', () => {
  const normalized = standalone.normalizeRequest(followUpPayload({
    followUpType: 'Closure Verification',
    effectivenessConfirmed: true,
    declaredBy: 'anderson.marmolejos',
  }));
  const finding = makeNode({ 'vso:findingStatus': 'In Progress' });

  standalone.updateFindingStatusFromFollowUp(finding, normalized);
  assertEqual(finding.properties['vso:closureRequestedBy'], 'anderson.marmolejos', 'vso:closureRequestedBy');
});

// 6. The guard must not over-reach. Most follow-ups declare no closure and are not required
//    to carry an operator identity; refusing those would break the ordinary path.
check('standalone: a non-closure follow-up needs no operator identity', () => {
  const normalized = standalone.normalizeRequest(followUpPayload({}));
  const finding = makeNode({ 'vso:findingStatus': 'In Progress' });

  const closed = standalone.updateFindingStatusFromFollowUp(finding, normalized);
  assertEqual(closed, false, 'return value');
  assertEqual(finding.properties['vso:findingStatus'], 'In Progress', 'the finding was mutated');
  assertEqual(finding.saves, 0, 'the finding was saved');
});

// 7. The canonical path's refusal. A source check, stated as one: the block it guards needs a
//    live repository to reach.
check('canonical: the closure block is guarded by a declarer check (source)', () => {
  const source = readFileSync(join(root, CANONICAL), 'utf8');
  const declarer = source.match(
    /var\s+canonicalClosureDeclarer\s*=\s*trimToNull\(report\.enteredBy\)\s*\|\|\s*trimToNull\(report\.declaredBy\);/,
  );
  assert(declarer, 'the canonical path no longer derives a closure declarer from enteredBy || declaredBy');

  const guardIndex = source.indexOf('closurePolicy.shouldClose && canonicalClosureDeclarer === null');
  assert(guardIndex !== -1, 'the canonical path does not refuse a closure with no declarer');

  const writeIndex = source.indexOf('findingNode.properties["vso:closureRequestedBy"]');
  assert(writeIndex !== -1, 'the canonical path no longer writes vso:closureRequestedBy');
  assert(guardIndex < writeIndex, 'the declarer guard runs after the closure is already recorded');
});

// 8. Both refusals must say the same thing. A caller switching endpoints should not have to
//    learn a second vocabulary for the same rule.
check('both paths refuse with the same message', () => {
  const standaloneSource = readFileSync(join(root, STANDALONE), 'utf8');
  const canonicalSource = readFileSync(join(root, CANONICAL), 'utf8');
  const sentence = 'Declaring a closure requires an operator identity: set followUpReport.enteredBy';
  assert(standaloneSource.includes(sentence), `${STANDALONE} does not carry the shared refusal message`);
  assert(canonicalSource.includes(sentence), `${CANONICAL} does not carry the shared refusal message`);
});

console.log('');
if (failures > 0) {
  console.error(`FAILED: ${failures} of ${checks} checks`);
  process.exit(1);
}
console.log(`OK: ${checks} checks — attribution complete on both import paths, no unattributable closure declaration`);
