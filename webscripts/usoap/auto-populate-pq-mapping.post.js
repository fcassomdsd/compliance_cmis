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

function loadPqMapping() {
  var mappingNode = companyhome.childByNamePath("configs/usoap-pq-mapping.json");
  if (mappingNode === null) {
    mappingNode = companyhome.childByNamePath("Data Dictionary/usoap-pq-mapping.json");
  }
  if (mappingNode === null) {
    fail(500, "USOAP PQ mapping file not found in repository");
  }
  return JSON.parse(mappingNode.content);
}

function matchIcaoReference(icaoRef, mapping) {
  if (!icaoRef) return null;
  var ref = String(icaoRef).trim();
  var annotations = mapping.annotations || {};

  // Sort keys by length descending so "Annex 14" matches before "Annex 1"
  var keys = Object.keys(annotations).sort(function(a, b) {
    return b.length - a.length;
  });

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Use word boundary to prevent "Annex 1" matching inside "Annex 14"
    var pattern = new RegExp("\\b" + escapedKey + "\\b", "i");
    if (pattern.test(ref)) {
      return {
        ce: annotations[key].ce || [],
        area: annotations[key].area || null,
        pqByArea: mapping.pqByArea || {}
      };
    }
  }
  return null;
}

function loadFindingNodes(inspectionCode, specialtyCode) {
  var query = '+TYPE:"vso:finding"';
  if (inspectionCode) {
    query += ' AND +@vso\\:inspectionId:"' + inspectionCode + '"';
  }
  if (specialtyCode) {
    query += ' AND +@vso\\:specialtyCode:"' + specialtyCode + '"';
  }
  try {
    return search.luceneSearch(query) || [];
  } catch (e) {
    return [];
  }
}

function loadEvidenceNodes() {
  try {
    return search.luceneSearch('+TYPE:"vso:evidenceItem"') || [];
  } catch (e) {
    return [];
  }
}

function loadChecklistItemNodes(inspectionCode, specialtyCode) {
  var query = '+TYPE:"vso:checklistItem"';
  if (inspectionCode) {
    query += ' AND +@vso\\:inspectionId:"' + inspectionCode + '"';
  }
  if (specialtyCode) {
    query += ' AND +@vso\\:specialtyCode:"' + specialtyCode + '"';
  }
  try {
    return search.luceneSearch(query) || [];
  } catch (e) {
    return [];
  }
}

function populateNode(node, icaoRef, nathionalRef, mapping) {
  var match = matchIcaoReference(icaoRef, mapping);
  if (!match) return false;

  var changed = false;
  var rawCe = node.properties["vso:ceMapping"];
  var currentCeMapping = rawCe
    ? (Array.isArray(rawCe) ? rawCe : [rawCe])
    : [];
  var currentPqRef = node.properties["vso:usoapPqReference"];
  if (!currentPqRef || !Array.isArray(currentPqRef)) {
    currentPqRef = currentPqRef ? [currentPqRef] : [];
  }

  for (var i = 0; i < match.ce.length; i++) {
    var ce = match.ce[i];
    if (currentCeMapping.indexOf(ce) === -1) {
      currentCeMapping.push(ce);
      changed = true;
    }
  }

  if (match.area && match.pqByArea[match.area]) {
    var areaPqs = match.pqByArea[match.area];
    for (var j = 0; j < areaPqs.length; j++) {
      var pq = areaPqs[j];
      if (currentPqRef.indexOf(pq) === -1) {
        currentPqRef.push(pq);
        changed = true;
      }
    }
  }

  if (changed) {
    if (currentCeMapping) {
      node.properties["vso:ceMapping"] = currentCeMapping;
    }
    if (currentPqRef.length > 0) {
      node.properties["vso:usoapPqReference"] = currentPqRef;
    }
    if (match.area) {
      node.properties["vso:usoapAreaCode"] = match.area;
    }
    if (match.ce.length > 0) {
      node.properties["vso:usoapCriticalElement"] = match.ce[0];
    }
    node.save();
  }

  return changed;
}

function main() {
  var requestBody = parseJsonPayload(requestbody.content);
  var inspectionCode = trimToNull(requestBody.inspectionCode) || null;
  var specialtyCode = trimToNull(requestBody.specialtyCode) || null;
  var dryRun = Boolean(requestBody.dryRun);

  var mapping = loadPqMapping();
  var summary = { findings: 0, evidence: 0, items: 0, updated: 0, skipped: 0 };
  var updatedNodes = [];

  var findingNodes = loadFindingNodes(inspectionCode, specialtyCode);
  var evidenceNodes = loadEvidenceNodes();
  var itemNodes = loadChecklistItemNodes(inspectionCode, specialtyCode);

  summary.findings = findingNodes.length;
  summary.evidence = evidenceNodes.length;
  summary.items = itemNodes.length;

  for (var f = 0; f < findingNodes.length; f++) {
    var node = findingNodes[f];
    var icaoRef = node.properties["vso:icaoReference"] || "";
    var natRef = node.properties["vso:nationalRegulation"] || "";
    if (!icaoRef && !natRef) {
      summary.skipped++;
      continue;
    }
    if (dryRun) {
      updatedNodes.push({ type: "finding", id: node.properties["vso:findingId"], icaoRef: icaoRef });
      continue;
    }
    if (populateNode(node, icaoRef, natRef, mapping)) {
      summary.updated++;
      updatedNodes.push({ type: "finding", id: node.properties["vso:findingId"], ce: node.properties["vso:ceMapping"] });
    }
  }

  for (var e = 0; e < evidenceNodes.length; e++) {
    var evNode = evidenceNodes[e];
    var evIcaoRef = evNode.properties["vso:icaoReference"] || "";
    if (!evIcaoRef) continue;
    if (dryRun) {
      updatedNodes.push({ type: "evidence", id: evNode.properties["vso:evidenceId"] });
      continue;
    }
    if (populateNode(evNode, evIcaoRef, null, mapping)) {
      summary.updated++;
    }
  }

  for (var ci = 0; ci < itemNodes.length; ci++) {
    var ciNode = itemNodes[ci];
    var ciIcaoRef = ciNode.properties["vso:icaoReference"] || "";
    if (!ciIcaoRef) continue;
    if (dryRun) {
      updatedNodes.push({ type: "checklistItem", id: ciNode.properties["vso:itemId"] });
      continue;
    }
    if (populateNode(ciNode, ciIcaoRef, null, mapping)) {
      summary.updated++;
    }
  }

  var result = {
    success: true,
    summary: summary,
    updated: updatedNodes.slice(0, 50),
    dryRun: dryRun
  };

  model.json = jsonUtils.toJSONString(result);
}

try {
  main();
} catch (error) {
  if (!model.json) {
    model.json = jsonUtils.toJSONString({ success: false, error: String(error) });
  }
}
