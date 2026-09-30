// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez
//
// Verifies that every copy of resolveVsoPaths() agrees with the canonical
// path table in webscripts/common/vso-paths.lib.js.
//
//   node scripts/verify-resolve-paths.mjs
//
// WHY THERE ARE COPIES AT ALL
//
// Web Scripts run on Alfresco's Rhino engine with no module system, and
// importScript() has been observed unavailable in at least one repo
// webscript's context. So each script inlines resolveVsoPaths(), which
// prefers a deployment-provided __VSO_PATHS, then tries importScript, and
// only then falls back to its own inlined defaults. That is deliberate. What
// it costs is that the defaults are duplicated, and duplicated constants
// drift.
//
// WHAT THE PREVIOUS CHECKER DID, AND WHY THIS REPLACES IT
//
// scripts/verify-resolve-paths.sh grepped each file for seven fixed strings
// -- "inspectionInProcessPath:", "return defaults", and so on. Three things
// followed, all of them found on 2026-09-29:
//
//   1. It never compared a VALUE. Every path in every copy could have said
//      ".../Wrong Folder" and it would still have passed, because it grepped
//      for the key NAME. The one failure mode it exists to catch was the one
//      thing it could not see.
//   2. It demanded all seven keys from every copy, but a copy legitimately
//      carries only the keys its script uses. So it had been FAILING on
//      develop -- two "mismatches" against follow-up-import, which needs
//      neither of the keys it was being failed for. A red check that is
//      wrong is worse than no check: it trains people to ignore it.
//   3. It searched `webscripts/**/*.post.js`, missing the copy in
//      scripts/transformInspectionPlan.js entirely.
//
// And no pipeline ran it, which is why 1-3 survived.
//
// WHAT THIS CHECKS INSTEAD
//
//   - Every key a copy declares exists in the canonical table, and its VALUE
//     matches. Subsets are fine; disagreement is not.
//   - The override chain is intact in every copy: __VSO_PATHS is consulted
//     BEFORE the inlined defaults. A copy that forgets this silently ignores
//     a deployment's path configuration while every other script honours it,
//     which is drift that only shows up as documents written to two different
//     folders.
//   - Inline `VSO_PATHS.someKey || "literal"` fallbacks match the canonical
//     value too. These are a second, invisible copy of the default: four of
//     them exist, none was covered before, and a partial __VSO_PATHS override
//     is exactly the case where a stale one takes effect.
//   - No file hardcodes a path under the site root outside those two
//     accounted-for forms. That is how a script stops participating in the
//     mechanism altogether.
//   - Every canonical key is claimed by at least one copy, so a path nobody
//     reads cannot sit in the table rotting.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const CANONICAL = "webscripts/common/vso-paths.lib.js";
// This file names every pattern it looks for, so without excluding itself it
// scans its own source and reports itself as a malformed copy.
const SELF = new URL(import.meta.url).pathname;

let failures = 0;
let passes = 0;
const ok = (m) => { passes++; console.log(`    ok   ${m}`); };
const no = (m) => { failures++; console.log(`    FAIL ${m}`); };
const step = (m) => console.log(`\n=== ${m}`);

// Extracts the object literal that follows `<marker>` and evaluates it.
// Brace-matched rather than regexed per line: a value containing a brace, or
// a key added on the same line as the opener, would slip past a line scanner
// and read as "this copy does not declare that key" -- which is the same
// silent pass the old checker gave.
function objectAfter(source, marker) {
  const at = source.indexOf(marker);
  if (at === -1) return null;
  const open = source.indexOf("{", at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const literal = source.slice(open, i + 1);
        return {
          value: new Function(`return (${literal});`)(),
          start: open,
          end: i + 1
        };
      }
    }
  }
  return null;
}

// The body of `function <name>(...)`, brace-matched. Slicing from the
// declaration to end-of-file instead -- which this did at first -- makes
// every check below see the whole rest of the script: two of the seven
// mutations written against this checker passed because of it, one finding a
// second copy of the importScript idiom further down the file and one finding
// a `return defaults` that was not this function's.
function functionBody(source, name) {
  const at = source.indexOf(`function ${name}`);
  if (at === -1) return null;
  const open = source.indexOf("{", at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(at, i + 1);
    }
  }
  return null;
}

function jsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...jsFiles(full));
    else if (/\.(js|mjs|cjs)$/.test(entry) && full !== SELF) out.push(full);
  }
  return out;
}

console.log("verify-resolve-paths — path table agreement across Web Scripts");

// --- the canonical table ---------------------------------------------------
step(`Canonical table (${CANONICAL})`);
const canonicalSource = readFileSync(join(ROOT, CANONICAL), "utf8");
const canonicalBlock = objectAfter(canonicalSource, "__VSO_PATHS = ");
if (!canonicalBlock) {
  console.log("    FAIL could not parse __VSO_PATHS out of the canonical library");
  process.exit(1);
}
const canonical = canonicalBlock.value;
const canonicalKeys = Object.keys(canonical);
ok(`${canonicalKeys.length} canonical path(s)`);

// The site root, derived rather than hardcoded: an adopting authority renames
// the site (see COUNTRY_ADAPTATION_GUIDE.md) and this check has to follow it
// there instead of being edited.
const siteRoots = new Set(
  Object.values(canonical)
    .map((v) => String(v).match(/^Sites\/[^/]+\//))
    .filter(Boolean)
    .map((m) => m[0])
);
if (siteRoots.size !== 1) {
  no(`the canonical table spans ${siteRoots.size} site roots (${[...siteRoots].join(", ")}) — every path should sit under one`);
}
const SITE_ROOT = [...siteRoots][0] || "Sites/";
ok(`site root: ${SITE_ROOT}`);

// --- the copies ------------------------------------------------------------
const allFiles = [...jsFiles(join(ROOT, "webscripts")), ...jsFiles(join(ROOT, "scripts"))];
const claimed = new Set();

const copies = [];
for (const file of allFiles) {
  const rel = relative(ROOT, file);
  if (rel === CANONICAL) continue;
  const source = readFileSync(file, "utf8");
  if (!source.includes("function resolveVsoPaths")) continue;
  copies.push({ rel, source });
}

step(`Copies of resolveVsoPaths() (${copies.length} found)`);
if (copies.length === 0) {
  no("no copies found — the search is looking in the wrong place");
}
for (const { rel } of copies) console.log(`         ${rel}`);

for (const { rel, source } of copies) {
  const fn = functionBody(source, "resolveVsoPaths");
  if (fn === null) {
    no(`${rel}: resolveVsoPaths() is declared but its body could not be delimited`);
    continue;
  }
  const defaults = objectAfter(fn, "var defaults =");
  if (!defaults) {
    no(`${rel}: resolveVsoPaths() has no parseable \`var defaults = {...}\``);
    continue;
  }

  let bad = 0;
  for (const [key, value] of Object.entries(defaults.value)) {
    claimed.add(key);
    if (!(key in canonical)) {
      no(`${rel}: declares '${key}', which the canonical table does not — a typo here silently uses a path nobody maintains`);
      bad++;
    } else if (canonical[key] !== value) {
      no(`${rel}: '${key}' is "${value}" but the canonical table says "${canonical[key]}"`);
      bad++;
    }
  }
  if (bad === 0) {
    ok(`${rel}: ${Object.keys(defaults.value).length} path(s) match the canonical table`);
  }

  // The override chain, checked as an ORDER rather than as a set of strings
  // that appear somewhere. __VSO_PATHS must be consulted before importScript
  // is attempted, and both before the inlined defaults are returned.
  //
  // Order is the whole property. __VSO_PATHS appears twice in every copy --
  // once up front, once inside the importScript loop -- so a copy that lost
  // the up-front check still contains the string and still "consults
  // __VSO_PATHS". But importScript is documented as unavailable in at least
  // one webscript's context, and where it is unavailable the loop never runs:
  // that copy would return its inlined defaults while a deployment-provided
  // __VSO_PATHS sat there unread, and every other script honoured it.
  // Searching for the string rather than its position missed exactly that,
  // when it was written as a mutation.
  const overrideAt = fn.indexOf("typeof __VSO_PATHS !== \"undefined\"");
  const importAt = fn.indexOf("typeof importScript");
  const classpathAt = fn.indexOf("classpath:alfresco/extension/templates/webscripts/common/vso-paths.lib.js");
  // indexOf, not lastIndexOf: it is the FIRST return of the inlined defaults
  // that has to come last in the chain. Written with lastIndexOf, an early
  // `return defaults;` inserted above the importScript block was invisible,
  // because the real one at the end of the function still satisfied the
  // ordering -- another mutation that passed.
  const returnDefaultsAt = fn.indexOf("return defaults");
  if (overrideAt === -1) {
    no(`${rel}: resolveVsoPaths() never consults __VSO_PATHS — a deployment override would not reach it`);
  } else if (returnDefaultsAt === -1) {
    no(`${rel}: resolveVsoPaths() never falls back to its inlined defaults`);
  } else if (importAt === -1 || classpathAt === -1) {
    no(`${rel}: resolveVsoPaths() has no importScript fallback to the canonical library`);
  } else if (!(overrideAt < importAt && importAt < returnDefaultsAt)) {
    no(`${rel}: resolveVsoPaths() checks __VSO_PATHS, importScript and its defaults out of order — __VSO_PATHS must win, and the inlined defaults must be last`);
  } else {
    ok(`${rel}: override chain intact (__VSO_PATHS → importScript → defaults)`);
  }
}

// --- inline `VSO_PATHS.key || "literal"` fallbacks --------------------------
step("Inline fallbacks (`VSO_PATHS.key || \"…\"`)");
let fallbacks = 0;
const accounted = new Map(); // rel -> Set of character ranges already explained
for (const file of allFiles) {
  const rel = relative(ROOT, file);
  if (rel === CANONICAL) continue;
  const source = readFileSync(file, "utf8");
  const ranges = [];
  if (source.includes("function resolveVsoPaths")) {
    const fnAt = source.indexOf("function resolveVsoPaths");
    const d = objectAfter(source.slice(fnAt), "var defaults =");
    if (d) ranges.push([fnAt + d.start, fnAt + d.end]);
  }
  const re = /VSO_PATHS\.([A-Za-z0-9_]+)\s*\|\|\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    fallbacks++;
    const [, key, value] = m;
    ranges.push([m.index, m.index + m[0].length]);
    claimed.add(key);
    const line = source.slice(0, m.index).split("\n").length;
    if (!(key in canonical)) {
      no(`${rel}:${line}: falls back for '${key}', which the canonical table does not declare`);
    } else if (canonical[key] !== value) {
      no(`${rel}:${line}: fallback for '${key}' is "${value}" but the canonical table says "${canonical[key]}"`);
    }
  }
  accounted.set(rel, ranges);
}
ok(`${fallbacks} inline fallback(s) checked`);

// --- anything else hardcoding a site path -----------------------------------
step(`Hardcoded paths under ${SITE_ROOT} outside those two forms`);
let stray = 0;
for (const file of allFiles) {
  const rel = relative(ROOT, file);
  if (rel === CANONICAL) continue;
  const source = readFileSync(file, "utf8");
  const ranges = accounted.get(rel) || [];
  let idx = -1;
  while ((idx = source.indexOf(SITE_ROOT, idx + 1)) !== -1) {
    if (ranges.some(([a, b]) => idx >= a && idx < b)) continue;
    const line = source.slice(0, idx).split("\n").length;
    const text = source.split("\n")[line - 1].trim();
    no(`${rel}:${line}: hardcoded site path outside resolveVsoPaths() — ${text.slice(0, 110)}`);
    stray++;
  }
}
if (stray === 0) ok("none — every site path goes through the canonical table");

// --- dead canonical entries -------------------------------------------------
step("Canonical entries nothing reads");
const dead = canonicalKeys.filter((k) => !claimed.has(k));
if (dead.length) {
  no(`no copy declares: ${dead.join(", ")} — a path nobody reads will drift unnoticed`);
} else {
  ok(`all ${canonicalKeys.length} canonical path(s) are claimed by at least one copy`);
}

console.log("");
if (failures > 0) {
  console.log(`${passes} passed, ${failures} FAILED`);
  process.exit(1);
}
console.log(`${passes} checks passed — every copy agrees with ${CANONICAL}.`);
