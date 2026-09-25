// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez
//
// Guards the plan/report regeneration contract:
//   * both generators render into a transient scratch node and file the PDF
//     themselves, checking in a new version when one already exists;
//   * neither writes the rendered .fodt back into the "Template data" folder
//     (which carries the .fodt -> .odt Share rule whose output collided on a
//     second run: "Duplicate child name not allowed: ... .odt");
//   * both clear a leaked transform temp node before rendering.
//
// A regression here is not caught by lint, so this runs in CI alongside the
// other validate:examples checks.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WEBSCRIPTS = [
  "webscripts/inspection-plan/generate-inspection-plan.post.js",
  "webscripts/inspection-report/generate-inspection-report.post.js",
];

const failures = [];

for (const relativePath of WEBSCRIPTS) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    failures.push(`${relativePath}: file is missing`);
    continue;
  }

  const source = fs.readFileSync(filePath, "utf8");

  const required = [
    ["function fileRenderedDocumentPdf(", "the shared render+filing helper"],
    ["checkout()", "checkout() for regeneration"],
    [".checkin(", "checkin() to create the new version"],
    ["isNewVersion", "the isNewVersion result"],
    ["removeRenderScratchNodes(", "stale transform-temp cleanup"],
  ];
  for (const [needle, why] of required) {
    if (!source.includes(needle)) {
      failures.push(`${relativePath}: missing ${why} (looked for "${needle}")`);
    }
  }

  // The render must not go back into the rule-guarded Template data folder.
  if (source.includes("upsertDocument(")) {
    failures.push(`${relativePath}: still calls upsertDocument — regeneration would write to Template data again`);
  }
  if (source.includes("TEMPLATE_DATA_PATH") || source.includes("DESTINATION_PATH")) {
    failures.push(`${relativePath}: still references the Template data destination path`);
  }
}

if (failures.length > 0) {
  console.error("verify-report-versioning: FAILED");
  for (const message of failures) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log("verify-report-versioning: OK (plan/report regenerate by checkin, not by re-writing Template data)");
