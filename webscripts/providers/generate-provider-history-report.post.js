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

function escapeAftsValue(value) {
  return String(value).replace(/"/g, '\\"');
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

// Restricts a query to one calendar year. A range clause is used rather than a
// "2026*" wildcard: Solr rejects the wildcard form for date fields with a 400.
function buildYearClause(fieldName, year) {
  if (!year) {
    return "";
  }

  var normalizedYear = String(year);
  if (!/^\d{4}$/.test(normalizedYear)) {
    return "";
  }

  return " AND +@vso\\:" + fieldName + ":[" + normalizedYear + "-01-01T00:00:00.000Z TO " +
    normalizedYear + "-12-31T23:59:59.999Z]";
}

// Narrows every artifact query to the specialties the caller may see. The
// report is what compliance_web serves a specialty-scoped session, and the
// summary and per-inspection counts must describe the same population as the
// artifact list, so the filter is pushed into the queries rather than applied
// to the list afterwards. Same comma-separated `specialtyCode` parameter the
// CE-evidence report takes; every content type this script reads carries
// vso:specialtyCode through the shared vso:serviceContext aspect.
function buildSpecialtyClause(specialtyCode) {
  var raw = trimToNull(specialtyCode);
  if (!raw) {
    return "";
  }

  var codes = raw.split(",");
  var clauses = [];
  for (var i = 0; i < codes.length; i++) {
    var code = trimToNull(codes[i]);
    if (code) {
      clauses.push('@vso\\:specialtyCode:"' + escapeAftsValue(code) + '"');
    }
  }

  return clauses.length > 0 ? " AND +(" + clauses.join(" OR ") + ")" : "";
}

// Rhino's plain-object property access can misbehave for purely-numeric
// string keys (e.g. a "2026" year bucket) - a bare `map[key] || 0` read
// can come back as a Scriptable NOT_FOUND sentinel instead of undefined,
// which then serializes into the JSON output instead of a count. Reading
// via hasOwnProperty avoids relying on that truthy-coercion.
function incrementCount(map, key) {
  var current = map.hasOwnProperty(key) ? map[key] : 0;
  map[key] = current + 1;
}

// Provider identity, previous oversight history, and open/outstanding
// items - deliberately bounded to the same five content types
// ce-evidence-report already queries (findings/evidence/checklistItems),
// extended with correctiveActions and followUpReports since "previous
// oversight results" specifically means CAP and follow-up outcomes, not
// just findings. All five carry vso:providerId/vso:providerName via the
// shared vso:serviceContext aspect.
function loadArtifactsByProvider(providerId, year, specialtyCode) {
  var artifacts = [];
  var providerClause = '+@vso\\:providerId:"' + escapeAftsValue(providerId) + '"';
  var specialtyClause = buildSpecialtyClause(specialtyCode);

  var findingQuery = '+TYPE:"vso:finding" AND ' + providerClause + specialtyClause + buildYearClause("dateIssued", year);
  var findings = searchCapped(findingQuery);
  for (var i = 0; i < findings.length; i++) {
    var f = findings[i];
    var fDate = toIsoDate(safeProp(f, "vso:dateIssued"));
    artifacts.push({
      type: "finding",
      nodeRef: String(f.nodeRef),
      findingId: safeProp(f, "vso:findingId"),
      findingLevel: safeProp(f, "vso:findingLevel"),
      findingStatus: safeProp(f, "vso:findingStatus"),
      status: safeProp(f, "vso:findingStatus"),
      description: safeProp(f, "vso:description"),
      dateForYear: fDate,
      inspectionId: safeProp(f, "vso:inspectionId"),
      locationCode: safeProp(f, "vso:locationCode"),
      locationName: safeProp(f, "vso:locationName"),
      specialtyCode: safeProp(f, "vso:specialtyCode"),
      specialtyName: safeProp(f, "vso:specialtyName"),
      providerName: safeProp(f, "vso:providerName"),
      resolutionDeadline: toIsoDate(safeProp(f, "vso:resolutionDeadline"))
    });
  }

  var capQuery = '+TYPE:"vso:correctiveAction" AND ' + providerClause + specialtyClause + buildYearClause("dueDate", year);
  var caps = searchCapped(capQuery);
  for (var j = 0; j < caps.length; j++) {
    var cap = caps[j];
    var capDate = toIsoDate(safeProp(cap, "vso:dueDate"));
    artifacts.push({
      type: "correctiveAction",
      nodeRef: String(cap.nodeRef),
      capId: safeProp(cap, "vso:capId"),
      acceptanceStatus: safeProp(cap, "vso:acceptanceStatus"),
      status: safeProp(cap, "vso:acceptanceStatus"),
      proposedAction: safeProp(cap, "vso:proposedAction"),
      dateForYear: capDate,
      inspectionId: safeProp(cap, "vso:inspectionId"),
      locationCode: safeProp(cap, "vso:locationCode"),
      locationName: safeProp(cap, "vso:locationName"),
      specialtyCode: safeProp(cap, "vso:specialtyCode"),
      specialtyName: safeProp(cap, "vso:specialtyName"),
      providerName: safeProp(cap, "vso:providerName")
    });
  }

  var followUpQuery = '+TYPE:"vso:followUpReport" AND ' + providerClause + specialtyClause + buildYearClause("followUpDate", year);
  var followUps = searchCapped(followUpQuery);
  for (var k = 0; k < followUps.length; k++) {
    var fu = followUps[k];
    var fuDate = toIsoDate(safeProp(fu, "vso:followUpDate"));
    artifacts.push({
      type: "followUpReport",
      nodeRef: String(fu.nodeRef),
      followUpId: safeProp(fu, "vso:followUpId"),
      followUpType: safeProp(fu, "vso:followUpType"),
      evidenceReviewStatus: safeProp(fu, "vso:evidenceReviewStatus"),
      status: safeProp(fu, "vso:evidenceReviewStatus"),
      effectivenessConfirmed: safeProp(fu, "vso:effectivenessConfirmed"),
      dateForYear: fuDate,
      inspectionId: safeProp(fu, "vso:inspectionId"),
      locationCode: safeProp(fu, "vso:locationCode"),
      locationName: safeProp(fu, "vso:locationName"),
      specialtyCode: safeProp(fu, "vso:specialtyCode"),
      specialtyName: safeProp(fu, "vso:specialtyName"),
      providerName: safeProp(fu, "vso:providerName")
    });
  }

  var checklistQuery = '+TYPE:"vso:checklistItem" AND ' + providerClause + specialtyClause;
  var checklistItems = searchCapped(checklistQuery);
  for (var m = 0; m < checklistItems.length; m++) {
    var ci = checklistItems[m];
    // The item's date comes from the vso:inspection ancestor, so a year clause
    // cannot be pushed into this query (a child-association item carries no
    // date property or parent-date condition of its own). The derived date is
    // filtered here instead. Items whose inspection has no window are excluded
    // from a year-filtered report for the same reason the pushdown excludes
    // nodes with no value on the date property: an undated item cannot be
    // claimed for the requested year. They remain in the unfiltered report.
    var ciDate = resolveChecklistItemDate(ci);
    if (year && (!ciDate || String(ciDate).indexOf(String(year)) !== 0)) continue;
    artifacts.push({
      type: "checklistItem",
      nodeRef: String(ci.nodeRef),
      itemId: safeProp(ci, "vso:itemId"),
      itemCode: safeProp(ci, "vso:itemCode"),
      complianceStatus: safeProp(ci, "vso:complianceStatus"),
      status: safeProp(ci, "vso:complianceStatus"),
      dateForYear: ciDate,
      inspectionId: safeProp(ci, "vso:inspectionId"),
      locationCode: safeProp(ci, "vso:locationCode"),
      specialtyCode: safeProp(ci, "vso:specialtyCode"),
      providerName: safeProp(ci, "vso:providerName")
    });
  }

  var evidenceQuery = '+TYPE:"vso:evidenceItem" AND ' + providerClause + specialtyClause + buildYearClause("collectionDate", year);
  var evidenceItems = searchCapped(evidenceQuery);
  for (var n = 0; n < evidenceItems.length; n++) {
    var ev = evidenceItems[n];
    var evDate = toIsoDate(safeProp(ev, "vso:collectionDate"));
    artifacts.push({
      type: "evidence",
      nodeRef: String(ev.nodeRef),
      evidenceRole: safeProp(ev, "vso:evidenceRole"),
      evidenceType: safeProp(ev, "vso:evidenceType"),
      name: ev.name || null,
      dateForYear: evDate,
      inspectionId: safeProp(ev, "vso:inspectionId"),
      locationCode: safeProp(ev, "vso:locationCode"),
      specialtyCode: safeProp(ev, "vso:specialtyCode"),
      providerName: safeProp(ev, "vso:providerName")
    });
  }

  return artifacts;
}

function groupByInspection(artifacts) {
  var byInspection = {};
  for (var i = 0; i < artifacts.length; i++) {
    var item = artifacts[i];
    var key = item.inspectionId || "Sin inspeccion asociada";
    if (!byInspection[key]) byInspection[key] = [];
    byInspection[key].push(item);
  }
  return byInspection;
}

// "Gaps" here means currently-open findings, not missing-metadata as in
// ce-evidence-report - the point of a provider-history lookup is knowing
// what's still outstanding before/during a new inspection of that provider.
function summarize(artifacts) {
  var summary = {
    total: artifacts.length,
    byType: {},
    byStatus: {},
    byLocation: {},
    byYear: [],
    openFindings: []
  };

  // Accumulated separately with a "Y"-prefixed key, never handed to
  // jsonUtils.toJSONString directly as a plain object - a purely-numeric
  // property name (e.g. "2026") triggers a Rhino/serialization quirk that
  // corrupts the value into a NOT_FOUND sentinel string. Converted to a
  // plain [{year, count}] array below instead.
  var yearCounts = {};

  for (var i = 0; i < artifacts.length; i++) {
    var item = artifacts[i];
    incrementCount(summary.byType, item.type);

    var loc = item.locationName || item.locationCode || "Sin ubicacion";
    incrementCount(summary.byLocation, loc);

    var yr = item.dateForYear ? String(item.dateForYear).slice(0, 4) : "Sin fecha";
    incrementCount(yearCounts, "Y" + yr);

    if (item.status) {
      incrementCount(summary.byStatus, item.status);
    }

    if (item.type === "finding" && item.findingStatus && item.findingStatus !== "Closed") {
      summary.openFindings.push({
        findingId: item.findingId,
        findingStatus: item.findingStatus,
        inspectionId: item.inspectionId,
        resolutionDeadline: item.resolutionDeadline
      });
    }
  }

  for (var key in yearCounts) {
    if (yearCounts.hasOwnProperty(key)) {
      summary.byYear.push({ year: key.slice(1), count: yearCounts[key] });
    }
  }

  return summary;
}

function main() {
  var requestBody = parseJsonPayload(requestbody.content);
  var providerId = trimToNull(requestBody.providerId);
  var year = trimToNull(requestBody.year) || null;
  // Optional: the specialties the caller may see (compliance_web passes the
  // session's scope). Absent means the whole report.
  var specialtyCode = trimToNull(requestBody.specialtyCode);

  if (!providerId) {
    fail(400, "Missing required parameter: providerId");
  }

  var artifacts = loadArtifactsByProvider(providerId, year, specialtyCode);
  var byInspection = groupByInspection(artifacts);
  var summary = summarize(artifacts);

  var report = {
    success: true,
    providerId: providerId,
    providerName: artifacts.length > 0 ? artifacts[0].providerName : null,
    year: year || "All",
    timestamp: new Date().toISOString(),
    summary: summary,
    byInspection: byInspection,
    artifacts: artifacts.slice(0, 500)
  };

  model.json = jsonUtils.toJSONString(report);
}

main();
