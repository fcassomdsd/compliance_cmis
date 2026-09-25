// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez
//
// Guards the uniform, generic, parameterized report header:
//   * every report template defines at least one running header;
//   * every header substitutes exactly the same placeholder set;
//   * the image frame declares its mime type from the entity profile;
//   * no authority-specific literal (IDAC's) is baked into a header;
//   * the header plumbing (RptHeader styles + a master page) is present.
//
// Run with `npm run verify:templates`; wired into CI alongside the other
// validate:examples checks.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES_DIR = path.join(ROOT, "templates");
const CONFIG_PATH = path.join(ROOT, "configs", "entity-profile.json");
const LOGO_PATH = path.join(ROOT, "configs", "entity-logo.png");

const TEMPLATES = [
  "formato plan de inspeccion.fodt",
  "Informe Final.fodt",
  "Checklist Reporte.fodt",
  "Finding Reporte.fodt",
  "FollowUp Reporte.fodt",
];

// The exact placeholder set every report header must use.
const REQUIRED_PLACEHOLDERS = [
  "entityLogoBase64",
  "entityLogoMimeType",
  "entityName",
  "labels.formHeading",
  "labels.docTitle",
  "labels.docSubtitle",
  "labels.codeLabel",
  "docControlCode",
  "labels.versionLabel",
  "docControlVersion",
  "docControlDate",
];

// Strings that mean a header is still branded for the reference deployment.
const FORBIDDEN_HEADER_LITERALS = [
  "IDAC",
  "DVSNA",
  "DVSO",
  "SNA/AGA",
  "FORMULARIO",
  "INFORME FINAL",
  "logo final idac",
  "01-02-2011",
  "08/07/2023",
];

// The body signature block: the plan's approver/position/date and the report's
// approver/position must be placeholders, not a baked-in signatory name, an IDAC
// job title, or a fixed date.
const BODY_SIGNATURE_PLACEHOLDERS = {
  "formato plan de inspeccion.fodt": ["planApprovedBy", "planApprovedByPosition", "signatureDate"],
  "Informe Final.fodt": ["reportApprovedBy", "reportApprovedByPosition"],
};

const FORBIDDEN_BODY_LITERALS = [
  "Ernesto de la Cruz",
  "Agustín José De Los Santos",
  "SNA/AGA",
  "Vigilancia SNA",
  "7 de marzo de 2026",
];

const failures = [];

function fail(message) {
  failures.push(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractHeaders(fodt) {
  return fodt.match(/<style:header>.*?<\/style:header>/gs) || [];
}

function placeholders(header) {
  const found = new Set();
  for (const match of header.matchAll(/\$\{\s*([^}]+?)\s*\}/g)) {
    found.add(match[1]);
  }
  return [...found].sort();
}

const expected = [...REQUIRED_PLACEHOLDERS].sort();

for (const template of TEMPLATES) {
  const filePath = path.join(TEMPLATES_DIR, template);
  if (!fs.existsSync(filePath)) {
    fail(`${template}: template is missing`);
    continue;
  }

  const fodt = read(filePath);
  const headers = extractHeaders(fodt);

  if (headers.length === 0) {
    fail(`${template}: no <style:header> block`);
    continue;
  }

  for (const [index, header] of headers.entries()) {
    const where = headers.length > 1 ? `${template} header #${index + 1}` : template;
    const actual = placeholders(header);

    const missing = expected.filter((key) => !actual.includes(key));
    const extra = actual.filter((key) => !expected.includes(key));
    if (missing.length > 0) {
      fail(`${where}: missing placeholder(s) ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      fail(`${where}: unexpected placeholder(s) ${extra.join(", ")}`);
    }

    if (!header.includes('draw:mime-type="${entityLogoMimeType}"')) {
      fail(`${where}: logo mime type is not parameterized`);
    }

    for (const literal of FORBIDDEN_HEADER_LITERALS) {
      if (header.includes(literal)) {
        fail(`${where}: contains authority-specific literal "${literal}"`);
      }
    }
  }

  if (!fodt.includes('style:name="RptHeader.Cell"')) {
    fail(`${template}: shared RptHeader styles are not defined`);
  }
  if (!/<office:master-styles[\s>]/.test(fodt)) {
    fail(`${template}: no <office:master-styles> to attach the header to`);
  }
  if (headers.length > 0 && !/style:page-layout/.test(fodt)) {
    fail(`${template}: header exists but no page layout is defined`);
  }

  for (const placeholder of BODY_SIGNATURE_PLACEHOLDERS[template] || []) {
    if (!fodt.includes("${" + placeholder + "}")) {
      fail(`${template}: body signature is missing the ${placeholder} placeholder`);
    }
  }
  for (const literal of FORBIDDEN_BODY_LITERALS) {
    if (fodt.includes(literal)) {
      fail(`${template}: contains the baked-in body literal "${literal}"`);
    }
  }
}

// The deployment-level profile must ship generic, blank defaults.
if (!fs.existsSync(CONFIG_PATH)) {
  fail("configs/entity-profile.json is missing");
} else {
  let profile;
  try {
    profile = JSON.parse(read(CONFIG_PATH));
  } catch (error) {
    fail(`configs/entity-profile.json is not valid JSON: ${error.message}`);
  }

  if (profile) {
    if (typeof profile.entityName !== "object" || profile.entityName === null) {
      fail("entity-profile.json: entityName must be locale-keyed (an object)");
    } else {
      for (const locale of ["es", "en"]) {
        if (typeof profile.entityName[locale] !== "string" || !profile.entityName[locale]) {
          fail(`entity-profile.json: entityName.${locale} must be a non-empty string`);
        }
      }
    }

    if (typeof profile.entityLogoPath !== "string" || !profile.entityLogoPath) {
      fail("entity-profile.json: entityLogoPath must name the drop-in logo file");
    }
    if (typeof profile.entityLogoBase64 === "string" && profile.entityLogoBase64.length > 0) {
      fail("entity-profile.json: ship entityLogoPath, not an inline entityLogoBase64 default");
    }

    for (const key of ["informeFinal", "planDeInspeccion", "checklistReport", "findingReport", "followUpReport"]) {
      if (!(key in (profile.docControlCodes || {}))) {
        fail(`entity-profile.json: docControlCodes.${key} is missing`);
      }
    }
    for (const key of ["docControlVersion", "docControlDate", "signatureDate"]) {
      if (typeof profile[key] !== "string") {
        fail(`entity-profile.json: ${key} must be a string`);
      }
    }

    if (typeof profile.signatures !== "object" || profile.signatures === null) {
      fail("entity-profile.json: signatures must be an object of locale-keyed blanks");
    } else {
      for (const key of ["planApprovedBy", "planApprovedByPosition", "reportApprovedBy", "reportApprovedByPosition"]) {
        const value = profile.signatures[key];
        if (typeof value !== "object" || value === null) {
          fail(`entity-profile.json: signatures.${key} must be locale-keyed (an object)`);
        }
      }
    }
  }
}

if (!fs.existsSync(LOGO_PATH)) {
  fail("configs/entity-logo.png (generic default logo) is missing");
} else {
  const logo = fs.readFileSync(LOGO_PATH);
  const isPng = logo.length > 8 && logo.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isPng) {
    fail("configs/entity-logo.png is not a PNG file");
  }
  if (logo.length < 1024) {
    fail("configs/entity-logo.png looks too small to be a real logo");
  }
}

if (failures.length > 0) {
  console.error("verify-report-headers: FAILED");
  for (const message of failures) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log(`verify-report-headers: OK (${TEMPLATES.length} templates, uniform header placeholders)`);
