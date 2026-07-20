// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

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

function loadArtifactsByCe(ce, year) {
  var artifacts = [];
  var query = '+@vso\\:usoapCriticalElement:"' + ce + '"';

  // Query findings
  var findingQuery = '+TYPE:"vso:finding" AND ' + query;
  var findings = search.luceneSearch(findingQuery);
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
  var evItems = search.luceneSearch(evQuery);
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
  var ciItems = search.luceneSearch(ciQuery);
  for (var k = 0; k < ciItems.length; k++) {
    var ci = ciItems[k];
    var ciYear = toIsoDate(safeProp(ci, "vso:inspectionDate"));
    if (year && ciYear && String(ciYear).indexOf(String(year)) !== 0) continue;
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

  var report = {
    success: true,
    ce: ce,
    year: year || "All",
    timestamp: new Date().toISOString(),
    summary: summary,
    byPq: byPq,
    artifacts: artifacts.slice(0, 500)
  };

  model.json = jsonUtils.toJSONString(report);
}

main();
