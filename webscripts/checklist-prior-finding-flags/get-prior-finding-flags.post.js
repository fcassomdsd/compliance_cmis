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

function trimProp(node, propName) {
  if (!node || !node.properties) {
    return "";
  }
  var value = node.properties[propName];
  return value === null || value === undefined ? "" : String(value).replace(/^\s+|\s+$/g, "");
}

function fail(code, message) {
  status.code = code;
  status.message = message;
  status.redirect = true;
  model = { error: message };
  throw new Error(message);
}

function parsePayload(rawContent) {
  var payload = trimToNull(rawContent);
  if (payload === null) {
    fail(400, "Request body is empty");
  }

  try {
    var parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object") {
      fail(400, "Invalid JSON payload structure");
    }
    return parsed;
  } catch (error) {
    fail(400, "Invalid JSON: " + error.message);
  }
}

function escapeLuceneValue(value) {
  return String(value).replace(/([+\-!(){}\[\]^"~*?:\\\/]|&&|\|\|)/g, "\\$1");
}

function isClosedStatus(statusValue) {
  return trimToNull(statusValue) !== null && String(statusValue).toLowerCase() === "closed";
}

function parseBoolean(value, defaultValue) {
  var normalized = trimToNull(value);
  if (normalized === null) {
    return defaultValue;
  }
  var lowered = normalized.toLowerCase();
  return lowered === "true" || lowered === "1" || lowered === "yes";
}

function keyMatchesAssocName(key, shortName) {
  if (!key) {
    return false;
  }

  return key === shortName ||
    key === "vso:" + shortName ||
    key.indexOf("}" + shortName) !== -1 ||
    key.indexOf(":" + shortName) !== -1;
}

function collectAssocNodesByShortName(node, shortName) {
  var buckets = [node ? node.assocs : null, node ? node.sourceAssocs : null, node ? node.targetAssocs : null];
  var collectedByRef = {};
  var collected = [];

  for (var bucketIndex = 0; bucketIndex < buckets.length; bucketIndex++) {
    var bucket = buckets[bucketIndex];
    if (!bucket) {
      continue;
    }

    for (var key in bucket) {
      if (!bucket.hasOwnProperty(key) || !keyMatchesAssocName(key, shortName)) {
        continue;
      }

      var nodes = bucket[key];
      if (!nodes) {
        continue;
      }
      if (!Array.isArray(nodes)) {
        nodes = [nodes];
      }

      for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
        var assocNode = nodes[nodeIndex];
        if (!assocNode || !assocNode.nodeRef) {
          continue;
        }

        var nodeRef = assocNode.nodeRef.toString();
        if (!collectedByRef[nodeRef]) {
          collectedByRef[nodeRef] = true;
          collected.push(assocNode);
        }
      }
    }
  }

  return collected;
}

function resolveSpecialtyFilter(input) {
  var specialtyId = trimToNull(input.specialtyId);
  if (specialtyId !== null) {
    return { field: "specialtyId", queryField: "@vso\\:specialtyId", value: specialtyId };
  }

  var specialtyCode = trimToNull(input.specialtyCode);
  if (specialtyCode !== null) {
    return { field: "specialtyCode", queryField: "@vso\\:specialtyCode", value: specialtyCode };
  }

  var legacyDomain = trimToNull(input.domain);
  if (legacyDomain !== null) {
    // Legacy compatibility: domain now maps to specialtyId semantics.
    return { field: "domain", queryField: "@vso\\:specialtyId", value: legacyDomain };
  }

  return null;
}

function buildChecklistQuery(inspectionId, specialtyFilter, onlyFlagged) {
  var query =
    "+TYPE:\"vso:checklistItem\" " +
    "@vso\\:inspectionId:\"NOT " + escapeLuceneValue(inspectionId) + "\" " +
    "+" + specialtyFilter.queryField + ":\"" + escapeLuceneValue(specialtyFilter.value) + "\"";

  if (onlyFlagged) {
    query += " +@vso\\:hasOpenPriorFinding:true";
  }

  return query;
}

function buildOpenFindingsByItemCodeQuery(itemCode, specialtyFilter, inspectionId, priorOnly) {
  var query =
    "+TYPE:\"vso:finding\" " +
    "+" + specialtyFilter.queryField + ":\"" + escapeLuceneValue(specialtyFilter.value) + "\" " +
    "+@vso\\:checklistItemCode:\"" + escapeLuceneValue(itemCode) + "\" " +
    "-@vso\\:findingStatus:\"Closed\"";

  if (priorOnly && inspectionId) {
    query += " -@vso\\:inspectionId:\"" + escapeLuceneValue(inspectionId) + "\"";
  }

  return query;
}

function resolveItemCode(itemNode) {
  return trimProp(itemNode, "vso:itemCode") || trimProp(itemNode, "vso:itemId");
}

function extractContext(itemNode) {
  if (!itemNode) {
    return null;
  }
  return {
    locationId: trimProp(itemNode, "vso:locationId"),
    locationCode: trimProp(itemNode, "vso:locationCode"),
    locationName: trimProp(itemNode, "vso:locationName"),
    specialtyId: trimProp(itemNode, "vso:specialtyId"),
    specialtyCode: trimProp(itemNode, "vso:specialtyCode"),
    specialtyName: trimProp(itemNode, "vso:specialtyName")
  };
}

function collectOpenFindingIdsByItemCode(itemCode, specialtyFilter, inspectionId, priorOnly) {
  var query = buildOpenFindingsByItemCodeQuery(itemCode, specialtyFilter, inspectionId, priorOnly);
  var findingNodes = searchCapped(query) || [];
  var findingSeen = {};
  var findingIds = [];

  for (var index = 0; index < findingNodes.length; index++) {
    var findingNode = findingNodes[index];
    if (!findingNode || !findingNode.isSubType || !findingNode.isSubType("vso:finding")) {
      continue;
    }

    var findingId = trimProp(findingNode, "vso:findingId");
    if (!findingId || findingSeen[findingId]) {
      continue;
    }

    findingSeen[findingId] = true;
    findingIds.push(findingId);
  }

  return findingIds;
}

function refreshChecklistFlags(checklistItems, dryRun) {
  var inspected = 0;
  var updated = 0;

  var specialtyFilter = null;
  var inspectionId = "";
  var priorOnly = true;
  if (arguments.length > 2 && arguments[2]) {
    specialtyFilter = arguments[2].specialtyFilter || null;
    inspectionId = arguments[2].inspectionId || "";
    priorOnly = arguments[2].priorOnly !== false;
  }

  for (var index = 0; index < checklistItems.length; index++) {
    var itemNode = checklistItems[index];
    if (!itemNode || !itemNode.isSubType || !itemNode.isSubType("vso:checklistItem")) {
      continue;
    }

    inspected += 1;
    var itemCode = resolveItemCode(itemNode);
    var shouldFlag = false;

    if (itemCode && specialtyFilter) {
      var openFindingsByCode = collectOpenFindingIdsByItemCode(itemCode, specialtyFilter, inspectionId, priorOnly);
      shouldFlag = openFindingsByCode.length > 0;
    }

    if (!shouldFlag) {
      var relatedFindings = collectAssocNodesByShortName(itemNode, "relatedPriorFinding");

      for (var findingIndex = 0; findingIndex < relatedFindings.length; findingIndex++) {
        var findingNode = relatedFindings[findingIndex];
        if (!findingNode || !findingNode.isSubType || !findingNode.isSubType("vso:finding")) {
          continue;
        }

        if (!isClosedStatus(trimProp(findingNode, "vso:findingStatus"))) {
          if (!priorOnly || trimProp(findingNode, "vso:inspectionId") !== inspectionId) {
            shouldFlag = true;
            break;
          }
        }
      }
    }

    var currentValue = itemNode.properties["vso:hasOpenPriorFinding"] === true;
    if (currentValue !== shouldFlag) {
      updated += 1;
      if (!dryRun) {
        itemNode.properties["vso:hasOpenPriorFinding"] = shouldFlag;
        itemNode.save();
      }
    }
  }

  return {
    inspected: inspected,
    updated: updated
  };
}

try {
  var input = parsePayload(requestbody.content);

  var inspectionId = trimToNull(input.inspectionId) || trimToNull(input.inspectionCode);
  if (inspectionId === null) {
    fail(400, "Missing required field: inspectionId or inspectionCode");
  }

  var specialtyFilter = resolveSpecialtyFilter(input);
  if (specialtyFilter === null) {
    fail(400, "Missing required field: specialtyId, specialtyCode, or domain");
  }

  var refreshBeforeQuery = parseBoolean(input.refreshBeforeQuery, false);
  var refreshDryRun = parseBoolean(input.refreshDryRun, false);
  var priorOnly = parseBoolean(input.priorOnly, true);

  var refreshSummary = null;
  if (refreshBeforeQuery) {
    var allChecklistItems = searchCapped(buildChecklistQuery(inspectionId, specialtyFilter, false)) || [];
    refreshSummary = refreshChecklistFlags(allChecklistItems, refreshDryRun, {
      inspectionId: inspectionId,
      specialtyFilter: specialtyFilter,
      priorOnly: priorOnly
    });
  }

  var query = buildChecklistQuery(inspectionId, specialtyFilter, true);

  var checklistItems = searchCapped(query) || [];
  var pairSeen = {};
  var pairs = [];
  var context = null;

  for (var index = 0; index < checklistItems.length; index++) {
    var itemNode = checklistItems[index];
    if (!itemNode || !itemNode.isSubType || !itemNode.isSubType("vso:checklistItem")) {
      continue;
    }

    var itemCode = resolveItemCode(itemNode);
    if (itemCode === "") {
      continue;
    }
    if (context === null) {
      context = extractContext(itemNode);
    }

    var findingIds = collectOpenFindingIdsByItemCode(itemCode, specialtyFilter, inspectionId, priorOnly);
    for (var findingIndex = 0; findingIndex < findingIds.length; findingIndex++) {
      var findingId = findingIds[findingIndex];
      var pairKey = itemCode + "||" + findingId;
      if (pairSeen[pairKey]) {
        continue;
      }

      pairSeen[pairKey] = true;
      pairs.push({
        itemCode: itemCode,
        findingId: findingId
      });
    }
  }

  status.code = 200;
  model.json = jsonUtils.toJSONString({
    items: pairs,
    count: pairs.length,
    optimization: {
      usedIndexedFlag: true,
      correlationKey: "itemCode",
      refreshBeforeQuery: refreshBeforeQuery,
      refreshDryRun: refreshDryRun,
      refreshSummary: refreshSummary
    },
    filters: {
      inspectionId: inspectionId,
      specialty: specialtyFilter.value,
      specialtyField: specialtyFilter.field,
      priorOnly: priorOnly,
      excludesStatus: "Closed"
    },
    context: context
  });
} catch (error) {
  logger.error("[get-prior-finding-flags] " + error.message);
  if (!model || !model.error) {
    fail(500, "Internal server error: " + error.message);
  }
}
