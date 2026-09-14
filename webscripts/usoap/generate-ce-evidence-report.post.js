// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

// Alfresco's Lucene search returns up to its configured maximum; the Web
// Scripts only ever need a bounded working set, so cap it explicitly and log
// truncation instead of silently processing whatever comes back.
var MAX_QUERY_RESULTS = 1000;

function searchCapped(query, maxResults) {
  var limit = maxResults || MAX_QUERY_RESULTS;
  var results = search.luceneSearch(query) || [];

  if (results.length > limit) {
    logger.warn("[vso] query returned " + results.length + " nodes; using the first " + limit +
      " (" + String(query).substring(0, 120) + ")");
    results = results.slice(0, limit);
  }

  return results;
}

function trimToNull(value) {
  if (value === null || value === undefined) {
    return null;
  }
  var normalized = String(value).replace(/^\s+|\s+$/g, "");
  return normalized.length === 0 ? null : normalized;
}

function fail(code, message) {
  status.code = code;
  status.message = message;
  status.redirect = true;
  model.json = jsonUtils.toJSONString({ success: false, error: message });
  throw new Error(message);
}

function parseJsonPayload(rawContent) {
  var payload = trimToNull(rawContent);
  if (payload === null) {
    fail(400, "Request body is empty");
  }
  try {
    return JSON.parse(payload);
  } catch (error) {
    fail(400, "Invalid JSON: " + error.message);
  }
}

function safeProp(node, name) {
  var val = node && node.properties ? node.properties[name] : null;
  return val !== null && val !== undefined ? val : null;
}

function toIsoDate(val) {
  if (!val) return null;
  try {
    var d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toISOString();
  } catch (e) {
    return String(val);
  }
}

// vso:checklistItem has no date of its own, and must not grow one: a checklist
// item is dated by the inspection it belongs to. The chain is item -> checklist
// document -> specialty folder -> vso:inspection folder, so walk the
// primary-parent chain to the nearest vso:inspection ancestor (the nearest one
// wins: a folder can itself be typed vso:inspection higher up the tree).
// Windows are cached per inspection nodeRef so an item-heavy report resolves
// each inspection once instead of re-walking for every item.
var inspectionWindowCache = {};

function resolveInspectionWindow(node) {
  var current = node;
  var depth = 0;

  // Bounded: the hierarchy is 4 levels deep today, so 8 is a generous ceiling
  // that still terminates if a node's parents ever form an unexpected chain.
  while (current && depth < 8) {
    var isInspection = false;
    try {
      isInspection = !!(current.isSubType && current.isSubType("vso:inspection"));
    } catch (typeError) {
      isInspection = false;
    }

    if (isInspection) {
      var inspectionRef = String(current.nodeRef);
      if (!inspectionWindowCache.hasOwnProperty(inspectionRef)) {
        inspectionWindowCache[inspectionRef] = {
          start: toIsoDate(safeProp(current, "vso:startDate")),
          end: toIsoDate(safeProp(current, "vso:endDate"))
        };
      }
      return inspectionWindowCache[inspectionRef];
    }

    try {
      current = current.parent;
    } catch (parentError) {
      current = null;
    }
    depth++;
  }

  return null;
}

// The effective date of a checklist item is its inspection's start date, or
// its end date when no start date was recorded - either end of the window
// identifies the calendar year the item is reported under.
function resolveChecklistItemDate(itemNode) {
  var inspectionWindow = resolveInspectionWindow(itemNode);
  if (!inspectionWindow) {
    return null;
  }

  return inspectionWindow.start || inspectionWindow.end;
}

function loadArtifactsByCe(ce, year) {
  var artifacts = [];
  // Query on ceMapping (multi-valued) rather than usoapCriticalElement
  // (single-valued "primary" CE) so artifacts relevant to more than one
  // Critical Element - e.g. a finding supporting both a CE-7 and a CE-8
  // PQ via the same citation - show up under every CE they belong to,
  // not just the first one resolved.
  var query = '+@vso\\:ceMapping:"' + ce + '"';

  // Query findings
  var findingQuery = '+TYPE:"vso:finding" AND ' + query;
  var findings = searchCapped(findingQuery);
  for (var i = 0; i < findings.length; i++) {
    var f = findings[i];
    var fYear = toIsoDate(safeProp(f, "vso:dateIssued"));
    if (year && fYear && String(fYear).indexOf(String(year)) !== 0) continue;
    artifacts.push({
      type: "finding",
      nodeRef: String(f.nodeRef),
      findingId: safeProp(f, "vso:findingId"),
      findingLevel: safeProp(f, "vso:findingLevel"),
      findingStatus: safeProp(f, "vso:findingStatus"),
      checklistItemCode: safeProp(f, "vso:checklistItemCode"),
      description: safeProp(f, "vso:description"),
      dateIssued: fYear,
      inspectionId: safeProp(f, "vso:inspectionId"),
      locationCode: safeProp(f, "vso:locationCode"),
      locationName: safeProp(f, "vso:locationName"),
      specialtyCode: safeProp(f, "vso:specialtyCode"),
      specialtyName: safeProp(f, "vso:specialtyName"),
      icaoReference: safeProp(f, "vso:icaoReference"),
      ceMapping: safeProp(f, "vso:ceMapping"),
      pqReferences: safeProp(f, "vso:usoapPqReference") || [],
      areaCode: safeProp(f, "vso:usoapAreaCode"),
      evidenceBasis: safeProp(f, "vso:usoapEvidenceBasis")
    });
  }

  // Query evidence items
  var evQuery = '+TYPE:"vso:evidenceItem" AND ' + query;
  var evItems = searchCapped(evQuery);
  for (var j = 0; j < evItems.length; j++) {
    var ev = evItems[j];
    artifacts.push({
      type: "evidence",
      nodeRef: String(ev.nodeRef),
      evidenceId: safeProp(ev, "vso:evidenceId"),
      evidenceType: safeProp(ev, "vso:evidenceType"),
      evidenceRole: safeProp(ev, "vso:evidenceRole"),
      source: safeProp(ev, "vso:source"),
      collectionDate: toIsoDate(safeProp(ev, "vso:collectionDate")),
      name: ev.name || null,
      size: safeProp(ev, "cm:content") ? ev.size : null,
      inspectionId: safeProp(ev, "vso:inspectionId"),
      locationCode: safeProp(ev, "vso:locationCode"),
      specialtyCode: safeProp(ev, "vso:specialtyCode"),
      icaoReference: safeProp(ev, "vso:icaoReference"),
      ceMapping: safeProp(ev, "vso:ceMapping"),
      pqReferences: safeProp(ev, "vso:usoapPqReference") || [],
      areaCode: safeProp(ev, "vso:usoapAreaCode"),
      evidenceBasis: safeProp(ev, "vso:usoapEvidenceBasis")
    });
  }

  // Query checklist items
  var ciQuery = '+TYPE:"vso:checklistItem" AND ' + query;
  var ciItems = searchCapped(ciQuery);
  for (var k = 0; k < ciItems.length; k++) {
    var ci = ciItems[k];
    // The item's date comes from the vso:inspection ancestor, so it cannot be
    // pushed into the query (a checklist item carries no date property of its
    // own). Items whose inspection has no window are excluded from a
    // year-filtered report; they remain in the unfiltered report.
    var ciDate = resolveChecklistItemDate(ci);
    if (year && (!ciDate || String(ciDate).indexOf(String(year)) !== 0)) continue;
    artifacts.push({
      type: "checklistItem",
      nodeRef: String(ci.nodeRef),
      itemId: safeProp(ci, "vso:itemId"),
      itemCode: safeProp(ci, "vso:itemCode"),
      requirementText: safeProp(ci, "vso:requirementText"),
      complianceStatus: safeProp(ci, "vso:complianceStatus"),
      inspectionId: safeProp(ci, "vso:inspectionId"),
      locationCode: safeProp(ci, "vso:locationCode"),
      specialtyCode: safeProp(ci, "vso:specialtyCode"),
      icaoReference: safeProp(ci, "vso:icaoReference"),
      ceMapping: safeProp(ci, "vso:ceMapping"),
      pqReferences: safeProp(ci, "vso:usoapPqReference") || [],
      areaCode: safeProp(ci, "vso:usoapAreaCode"),
      evidenceBasis: safeProp(ci, "vso:usoapEvidenceBasis")
    });
  }

  return artifacts;
}

function groupByPq(artifacts) {
  var byPq = {};
  for (var i = 0; i < artifacts.length; i++) {
    var item = artifacts[i];
    var pqs = item.pqReferences;
    if (!pqs || (Array.isArray(pqs) && pqs.length === 0)) {
      if (!byPq["Sin PQ asignado"]) byPq["Sin PQ asignado"] = [];
      byPq["Sin PQ asignado"].push(item);
      continue;
    }
    if (Array.isArray(pqs)) {
      for (var j = 0; j < pqs.length; j++) {
        var pq = String(pqs[j]).trim();
        if (!byPq[pq]) byPq[pq] = [];
        byPq[pq].push(item);
      }
    } else {
      var pq = String(pqs).trim();
      if (!byPq[pq]) byPq[pq] = [];
      byPq[pq].push(item);
    }
  }
  return byPq;
}

// Maps a UsoapEvidenceExpectation artifactCategory (atrocore-docker) to the
// Alfresco node type(s) that represent it, for Type-2 (sampled-population)
// PQ resolution. Categories with no dedicated content type today (manuals,
// licenses, training/personnel records, oversight plans, aerodrome dossiers)
// fall back to plain cm:content -- see docs/usoap-evidence-structure.md,
// "Type-2 (sampled population) resolution".
var POPULATION_CATEGORY_TYPES = {
  "Checklist": ["vso:inspectionChecklist"],
  "InspectionReport": ["vso:inspection"],
  "AuditReport": ["vso:inspection"],
  "CAPExecution": ["vso:correctiveAction", "vso:followUpReport"],
  "TrainingRecord": ["cm:content"],
  "PersonnelFile": ["cm:content"],
  "Manual": ["cm:content"],
  "License": ["cm:content"],
  "OversightPlan": ["cm:content"],
  "AerodromeDossier": ["cm:content"]
};

// vso: custom types are only ever created by this app's own import/creation
// paths (canonical-model-import, CAP/follow-up routers) inside the site
// folders below, and always carry vso:serviceContext (vso:specialtyCode).
// Plain cm:content documents (the fallback types above) are ordinary Share
// uploads: they can live anywhere in the repository (Data Dictionary, other
// sites' sample content, discussion posts, smart-folder template JSON, etc.)
// and never carry vso:specialtyCode unless someone has explicitly tagged
// them, so specialty filtering by that property silently zeroes out real
// candidates for these categories. Folder scoping (POPULATION_CATEGORY_FOLDERS
// below) is the only reliable relevance signal available for them today.
var CATEGORIES_WITH_SPECIALTY_PROPERTY = {
  "Checklist": true,
  "InspectionReport": true,
  "AuditReport": true,
  "CAPExecution": true
};

var SITE_DOCLIB_PATH = "Sites/vigilancia-de-la-so/documentLibrary";

// Relative to SITE_DOCLIB_PATH. Mapped from the folders actually present in
// the live instance (verified 2026-09-07) closest to each category's real-
// world evidence. License and AerodromeDossier have no dedicated folder yet
// in this instance -- scoped to the closest existing parent as a documented
// gap rather than left unscoped; a candidateCount of 0 there is expected
// until those folders/documents exist, and surfaces as a normal "population"
// gap rather than a flood of unrelated repository content.
//
// "Vigilancia/Datos de campo" is deliberately excluded from every mapping:
// it holds canonical field-collection data that already exists in final
// form elsewhere (checklist items, evidence items, findings -- all queried
// directly by type in loadArtifactsByCe) and its contents are not USOAP-
// tagged, so including it here would reintroduce untagged, already-
// represented noise into a sampled-population result.
var POPULATION_CATEGORY_FOLDERS = {
  "TrainingRecord": ["Capacitacion y competencia/Registros de capacitacion", "Capacitacion y competencia/Programas y planes de capacitacion"],
  "PersonnelFile": ["Capacitacion y competencia"],
  "Manual": ["Documentos/Manuales externos"],
  "License": ["Documentos"],
  "OversightPlan": ["Vigilancia/Planificacion anual"],
  "AerodromeDossier": ["Datos/AGA"]
};

var MAX_POPULATION_CANDIDATES = 50;

var ancestorNodeRefCache = {};

// Resolves a documentLibrary-relative path to its nodeRef via childByNamePath
// (the established idiom in this codebase -- see webscripts/common/vso-paths.lib.js
// and canonical-model-import) rather than hand-building a Lucene PATH:
// expression, which would require ISO9075 QName-encoding every folder name
// (including diacritics and spaces like "Capacitacion y competencia").
function resolveAncestorNodeRef(relativePath) {
  if (ancestorNodeRefCache.hasOwnProperty(relativePath)) {
    return ancestorNodeRefCache[relativePath];
  }
  var folder = companyhome.childByNamePath(relativePath);
  var nodeRef = folder ? String(folder.nodeRef) : null;
  ancestorNodeRefCache[relativePath] = nodeRef;
  return nodeRef;
}

function resolvePopulationCandidates(query) {
  var pqCode = trimToNull(query.pqCode);
  var artifactCategory = trimToNull(query.artifactCategory);
  var specialtyCode = trimToNull(query.specialtyCode);
  var monthsBack = query.monthsBack;

  var types = POPULATION_CATEGORY_TYPES[artifactCategory];
  if (!artifactCategory || !types) {
    return {
      pqCode: pqCode,
      artifactCategory: artifactCategory,
      candidateCount: 0,
      candidates: [],
      error: "Unknown or unsupported artifactCategory: " + artifactCategory
    };
  }

  // Always scope to the Vigilancia site's document library, never the whole
  // repository -- otherwise cm:content fallback categories match Data
  // Dictionary content models, smart-folder template JSON, other sites'
  // sample content (swsdp), discussion posts, etc.
  var siteRootRef = resolveAncestorNodeRef(SITE_DOCLIB_PATH);
  if (!siteRootRef) {
    return {
      pqCode: pqCode,
      artifactCategory: artifactCategory,
      candidateCount: 0,
      candidates: [],
      error: "Could not resolve site document library path: " + SITE_DOCLIB_PATH
    };
  }

  var typeClauses = [];
  for (var i = 0; i < types.length; i++) {
    typeClauses.push('TYPE:"' + types[i] + '"');
  }
  var luceneQuery = "+(" + typeClauses.join(" OR ") + ")";
  luceneQuery += ' AND +ANCESTOR:"' + siteRootRef + '"';

  // Narrow further to the specific folder(s) that hold this category's real
  // evidence, when known -- the primary "is this actually relevant to the
  // PQ" signal for categories with no dedicated content type/property.
  var folderPaths = POPULATION_CATEGORY_FOLDERS[artifactCategory];
  var scopedFolders = [];
  if (folderPaths && folderPaths.length) {
    var folderClauses = [];
    for (var f = 0; f < folderPaths.length; f++) {
      var relPath = SITE_DOCLIB_PATH + "/" + folderPaths[f];
      var folderRef = resolveAncestorNodeRef(relPath);
      if (folderRef) {
        folderClauses.push('ANCESTOR:"' + folderRef + '"');
        scopedFolders.push(folderPaths[f]);
      }
    }
    if (folderClauses.length) {
      luceneQuery += " AND +(" + folderClauses.join(" OR ") + ")";
    }
  }

  if (specialtyCode && CATEGORIES_WITH_SPECIALTY_PROPERTY[artifactCategory]) {
    var specialtyCodes = specialtyCode.split(",");
    var specialtyClauses = [];
    for (var s = 0; s < specialtyCodes.length; s++) {
      var code = trimToNull(specialtyCodes[s]);
      if (code) {
        specialtyClauses.push('@vso\\:specialtyCode:"' + code + '"');
      }
    }
    if (specialtyClauses.length) {
      luceneQuery += " AND +(" + specialtyClauses.join(" OR ") + ")";
    }
  }

  if (monthsBack && !isNaN(monthsBack)) {
    var since = new Date();
    since.setMonth(since.getMonth() - Number(monthsBack));
    luceneQuery += ' AND +@cm\\:modified:["' + since.toISOString() + '" TO NOW]';
  }

  var results;
  try {
    results = searchCapped(luceneQuery);
  } catch (error) {
    return {
      pqCode: pqCode,
      artifactCategory: artifactCategory,
      candidateCount: 0,
      candidates: [],
      error: "Query failed: " + error.message
    };
  }

  var candidates = [];
  for (var j = 0; j < results.length && candidates.length < MAX_POPULATION_CANDIDATES; j++) {
    var r = results[j];
    candidates.push({
      nodeRef: String(r.nodeRef),
      name: r.name || null,
      path: r.displayPath || null,
      modifiedAt: toIsoDate(safeProp(r, "cm:modified"))
    });
  }

  var result = {
    pqCode: pqCode,
    artifactCategory: artifactCategory,
    candidateCount: results.length,
    candidates: candidates
  };
  if (scopedFolders.length) {
    result.scopedFolders = scopedFolders;
  }
  return result;
}

function summarize(artifacts) {
  var summary = {
    total: artifacts.length,
    byType: {},
    byPq: {},
    byArea: {},
    gaps: []
  };

  for (var i = 0; i < artifacts.length; i++) {
    var item = artifacts[i];
    summary.byType[item.type] = (summary.byType[item.type] || 0) + 1;
    var area = item.areaCode || "Sin area";
    summary.byArea[area] = (summary.byArea[area] || 0) + 1;

    var pqs = item.pqReferences;
    if (!pqs || (Array.isArray(pqs) && pqs.length === 0)) {
      summary.byPq["Sin PQ"] = (summary.byPq["Sin PQ"] || 0) + 1;
    } else if (Array.isArray(pqs)) {
      for (var j = 0; j < pqs.length; j++) {
        var pq = String(pqs[j]).trim();
        summary.byPq[pq] = (summary.byPq[pq] || 0) + 1;
      }
    } else {
      summary.byPq[String(pqs).trim()] = (summary.byPq[String(pqs).trim()] || 0) + 1;
    }

    if (!item.icaoReference) summary.gaps.push({ type: item.type, id: item.findingId || item.itemId || item.evidenceId, gap: "Missing ICAO reference" });
    if (!item.evidenceBasis) summary.gaps.push({ type: item.type, id: item.findingId || item.itemId || item.evidenceId, gap: "Missing evidence basis" });
  }

  return summary;
}

function main() {
  var requestBody = parseJsonPayload(requestbody.content);
  var ce = trimToNull(requestBody.ce);
  var year = trimToNull(requestBody.year) || null;

  if (!ce) {
    fail(400, "Missing required parameter: ce (e.g., CE-1 through CE-8)");
  }

  if (!/^CE-[1-8]$/.test(ce)) {
    fail(400, "Invalid ce parameter: " + ce + ". Must be CE-1 through CE-8.");
  }

  var artifacts = loadArtifactsByCe(ce, year);
  var byPq = groupByPq(artifacts);
  var summary = summarize(artifacts);

  // Type-2 (sampled-population) PQs: the caller (compliance_web, which owns
  // the UsoapEvidenceExpectation catalog) supplies what to query for; this
  // webscript stays stateless with respect to AtroCore and only resolves the
  // Alfresco-side candidate documents. Omitting populationQueries preserves
  // the exact response shape this endpoint had before Type-2 support existed.
  var sampledPopulations = null;
  if (requestBody.populationQueries && requestBody.populationQueries.length) {
    sampledPopulations = [];
    for (var i = 0; i < requestBody.populationQueries.length; i++) {
      var resolved = resolvePopulationCandidates(requestBody.populationQueries[i] || {});
      sampledPopulations.push(resolved);
      if (resolved.candidateCount === 0) {
        summary.gaps.push({
          type: "population",
          pqCode: resolved.pqCode,
          gap: "No candidate documents found in expected population" + (resolved.error ? " (" + resolved.error + ")" : "")
        });
      }
    }
  }

  var report = {
    success: true,
    ce: ce,
    year: year || "All",
    timestamp: new Date().toISOString(),
    summary: summary,
    byPq: byPq,
    artifacts: artifacts.slice(0, 500)
  };
  if (sampledPopulations !== null) {
    report.sampledPopulations = sampledPopulations;
  }

  model.json = jsonUtils.toJSONString(report);
}

main();
