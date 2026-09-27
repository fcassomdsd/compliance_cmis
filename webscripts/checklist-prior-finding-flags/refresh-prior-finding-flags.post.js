// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

// --- BEGIN vso-describe-error (byte-identical across Web Scripts; scripts/verify-error-describer.sh) ---
// Describe a caught error in a way that survives a Java exception.
//
// `error.message` is undefined when a Java exception surfaces into Rhino,
// which is how most repository failures arrive here. An outer catch that
// builds its response and its log line from `error.message` directly turns
// such a failure into `"error": null` in the JSON and the literal text
// "undefined" in alfresco.log -- a failure that destroys its own diagnosis,
// costing a full debugging cycle per guess. Found exactly that way: a CI run
// answered `{"success": false, "error": null}` and neither the response nor
// the repository log said anything more.
//
// This started as a local helper in generate-inspection-plan.post.js, which
// had it right and was the only Web Script using it. It is now the shared
// copy: every access is guarded, because this runs while something has
// already gone wrong and a describer that throws replaces one lost diagnosis
// with two, and the Java exception's class name is reported explicitly --
// AccessDeniedException, ContentIOException, IntegrityException -- since the
// class alone is usually the whole answer.
function describeError(error) {
  if (!error) {
    return "Unknown error";
  }

  var parts = [];

  try {
    if (error.message) {
      parts.push(String(error.message));
    }
  } catch (ignoredMessage) {
    // deliberately empty: a describer must not throw
  }

  try {
    if (error.javaException) {
      parts.push(String(error.javaException.getClass().getName()) + ": " +
        String(error.javaException.getMessage()));
    }
  } catch (ignoredJava) {
    // deliberately empty
  }

  if (parts.length === 0) {
    try {
      parts.push(String(error));
    } catch (ignoredString) {
      parts.push("unprintable error object");
    }
  }

  try {
    if (error.fileName) {
      parts.push("at " + error.fileName + ":" + error.lineNumber);
    }
  } catch (ignoredWhere) {
    // deliberately empty
  }

  return parts.join(" | ");
}
// --- END vso-describe-error ---

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

function parseBoolean(value, defaultValue) {
  var normalized = trimToNull(value);
  if (normalized === null) {
    return defaultValue;
  }
  var lowered = normalized.toLowerCase();
  return lowered === "true" || lowered === "1" || lowered === "yes";
}

function escapeLuceneValue(value) {
  return String(value).replace(/([+\-!(){}\[\]^"~*?:\\\/]|&&|\|\|)/g, "\\$1");
}

function isClosedStatus(statusValue) {
  return trimToNull(statusValue) !== null && String(statusValue).toLowerCase() === "closed";
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

function buildChecklistQuery(inspectionId, specialtyFilter) {
  return "+TYPE:\"vso:checklistItem\" " +
    "+@vso\\:inspectionId:\"" + escapeLuceneValue(inspectionId) + "\" " +
    "+" + specialtyFilter.queryField + ":\"" + escapeLuceneValue(specialtyFilter.value) + "\"";
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

function hasOpenPriorFindingByItemCode(itemCode, specialtyFilter, inspectionId, priorOnly) {
  if (!itemCode || !specialtyFilter) {
    return false;
  }

  var findingNodes = searchCapped(buildOpenFindingsByItemCodeQuery(itemCode, specialtyFilter, inspectionId, priorOnly)) || [];
  return findingNodes.length > 0;
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

  var dryRun = parseBoolean(input.dryRun, false);
  var priorOnly = parseBoolean(input.priorOnly, true);
  var query = buildChecklistQuery(inspectionId, specialtyFilter);
  var checklistItems = searchCapped(query) || [];

  var inspected = 0;
  var updated = 0;
  var flagged = 0;
  var unflagged = 0;
  var updatedItems = [];
  var context = null;

  for (var index = 0; index < checklistItems.length; index++) {
    var itemNode = checklistItems[index];
    if (!itemNode || !itemNode.isSubType || !itemNode.isSubType("vso:checklistItem")) {
      continue;
    }

    inspected += 1;
    var checklistItemId = trimProp(itemNode, "vso:itemId");
    var itemCode = resolveItemCode(itemNode);
    if (context === null) {
      context = extractContext(itemNode);
    }

    var hasOpenPriorFinding = hasOpenPriorFindingByItemCode(itemCode, specialtyFilter, inspectionId, priorOnly);

    if (!hasOpenPriorFinding) {
      var relatedFindings = collectAssocNodesByShortName(itemNode, "relatedPriorFinding");
      for (var findingIndex = 0; findingIndex < relatedFindings.length; findingIndex++) {
        var findingNode = relatedFindings[findingIndex];
        if (!findingNode || !findingNode.isSubType || !findingNode.isSubType("vso:finding")) {
          continue;
        }

        if (!isClosedStatus(trimProp(findingNode, "vso:findingStatus"))) {
          if (!priorOnly || trimProp(findingNode, "vso:inspectionId") !== inspectionId) {
            hasOpenPriorFinding = true;
            break;
          }
        }
      }
    }

    if (hasOpenPriorFinding) {
      flagged += 1;
    } else {
      unflagged += 1;
    }

    var current = itemNode.properties["vso:hasOpenPriorFinding"] === true;
    if (current !== hasOpenPriorFinding) {
      updated += 1;
      updatedItems.push({
        itemCode: itemCode,
        checklistItemId: checklistItemId,
        from: current,
        to: hasOpenPriorFinding
      });

      if (!dryRun) {
        itemNode.properties["vso:hasOpenPriorFinding"] = hasOpenPriorFinding;
        itemNode.save();
      }
    }
  }

  status.code = 200;
  model.json = jsonUtils.toJSONString({
    inspectionId: inspectionId,
    specialty: specialtyFilter.value,
    specialtyField: specialtyFilter.field,
    priorOnly: priorOnly,
    correlationKey: "itemCode",
    context: context,
    dryRun: dryRun,
    inspected: inspected,
    updated: updated,
    flagged: flagged,
    unflagged: unflagged,
    updatedItems: updatedItems
  });
} catch (error) {
  // describeError, not error.message: a Java exception surfacing into Rhino
  // has no `message`, which turned a real failure into the literal text
  // "undefined" in both the log and the response.
  var describedError = describeError(error);
  logger.error("[refresh-prior-finding-flags] " + describedError);
  if (!model || !model.error) {
    fail(500, "Internal server error: " + describedError);
  }
}
