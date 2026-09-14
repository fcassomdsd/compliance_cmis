// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

// Alfresco's Lucene search returns up to its configured maximum; this Web
// Script only needs a bounded working set of findings/CAPs, so cap it
// explicitly and log truncation instead of silently processing everything.
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

function toDateString(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  var parsed = Object.prototype.toString.call(value) === "[object Date]"
    ? value
    : new Date(String(value));

  return isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function clampDescription(value, maxLength) {
  var normalized = trimToNull(value);
  if (normalized === null) {
    return "";
  }

  return normalized.length > maxLength ? normalized.substring(0, maxLength) : normalized;
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

function selectFirstNodeBySubtype(nodes, subtype) {
  for (var index = 0; index < nodes.length; index++) {
    if (nodes[index] && nodes[index].isSubType && nodes[index].isSubType(subtype)) {
      return nodes[index];
    }
  }
  return null;
}

function normalizeCapIdentifier(value) {
  var normalized = trimToNull(value);
  if (normalized === null) {
    return null;
  }

  if (normalized.indexOf("CAP-") === 0) {
    return normalized.substring(4);
  }

  return normalized;
}

function toNodeArray(value) {
  if (value === null || value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function findCorrectiveActionByProperty(findingNode) {
  if (!findingNode || !findingNode.properties) {
    return null;
  }

  var rawAssocValue = findingNode.properties["vso:hasCorrectiveAction"];
  var assocValues = toNodeArray(rawAssocValue);

  for (var index = 0; index < assocValues.length; index++) {
    var assocValue = assocValues[index];
    var assocText = trimToNull(assocValue);
    if (assocText === null) {
      continue;
    }

    var normalizedCapId = normalizeCapIdentifier(assocText);
    var capQuery =
      "+TYPE:\"vso:correctiveAction\" " +
      "+(@cm\\:name:\"" + escapeLuceneValue(assocText) + "\" " +
      "OR @vso\\:capId:\"" + escapeLuceneValue(assocText) + "\" " +
      "OR @vso\\:capId:\"" + escapeLuceneValue(normalizedCapId) + "\")";

    var capMatches = searchCapped(capQuery) || [];
    var capNode = selectFirstNodeBySubtype(capMatches, "vso:correctiveAction");
    if (capNode) {
      return capNode;
    }
  }

  return null;
}

function toScriptNodeArray(nodes) {
  if (!nodes) {
    return [];
  }
  return Array.isArray(nodes) ? nodes : [nodes];
}

function findCorrectiveActionByReloadedNode(findingNode) {
  if (!findingNode || !findingNode.nodeRef) {
    return null;
  }

  var reloadedNode = search.findNode(String(findingNode.nodeRef));
  if (!reloadedNode) {
    return null;
  }

  var byAssoc = selectFirstNodeBySubtype(
    collectAssocNodesByShortName(reloadedNode, "hasCorrectiveAction"),
    "vso:correctiveAction"
  );
  if (byAssoc) {
    return byAssoc;
  }

  return selectFirstNodeBySubtype(toScriptNodeArray(reloadedNode.children), "vso:correctiveAction");
}

function resolveSpecialtyFromNode(node) {
  return {
    specialtyId: trimProp(node, "vso:specialtyId"),
    specialtyCode: trimProp(node, "vso:specialtyCode"),
    specialtyName: trimProp(node, "vso:specialtyName")
  };
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

function resolveLocationFilter(input) {
  var locationId = trimToNull(input.locationId);
  if (locationId !== null) {
    return { field: "locationId", queryField: "@vso\\:locationId", value: locationId };
  }

  var locationCode = trimToNull(input.locationCode);
  if (locationCode !== null) {
    return { field: "locationCode", queryField: "@vso\\:locationCode", value: locationCode };
  }

  var legacyIcaoCode = trimToNull(input.icaoCode);
  if (legacyIcaoCode !== null) {
    // Legacy compatibility: ICAO code now maps to locationCode semantics.
    return { field: "icaoCode", queryField: "@vso\\:locationCode", value: legacyIcaoCode };
  }

  return null;
}

try {
  var input = parsePayload(requestbody.content);

  var locationFilter = resolveLocationFilter(input);
  if (locationFilter === null) {
    fail(400, "Missing required field: locationId, locationCode, or icaoCode");
  }

  var specialtyFilter = resolveSpecialtyFilter(input);
  if (specialtyFilter === null) {
    fail(400, "Missing required field: specialtyId, specialtyCode, or domain");
  }

  var skipCount = parseInt(input.skipCount, 10);
  var maxItems = parseInt(input.maxItems, 10);
  if (isNaN(skipCount) || skipCount < 0) {
    skipCount = 0;
  }
  if (isNaN(maxItems) || maxItems <= 0) {
    maxItems = 100;
  }

  var query =
    "+TYPE:\"vso:finding\" " +
    "+" + locationFilter.queryField + ":\"" + escapeLuceneValue(locationFilter.value) + "\" " +
    "+" + specialtyFilter.queryField + ":\"" + escapeLuceneValue(specialtyFilter.value) + "\" " +
    "-@vso\\:findingStatus:\"Closed\"";

  var matched = searchCapped(query) || [];
  var findings = [];

  for (var index = skipCount; index < matched.length && findings.length < maxItems; index++) {
    var findingNode = matched[index];
    if (!findingNode || !findingNode.isSubType || !findingNode.isSubType("vso:finding")) {
      continue;
    }
    var findingStatus = trimProp(findingNode, "vso:findingStatus");
    if (isClosedStatus(findingStatus)) {
      continue;
    }

    var relatedChecklistItems = collectAssocNodesByShortName(findingNode, "hasFinding");
    var relatedChecklistItem = selectFirstNodeBySubtype(relatedChecklistItems, "vso:checklistItem");

    var correctiveActions = collectAssocNodesByShortName(findingNode, "hasCorrectiveAction");
    var correctiveActionNode = selectFirstNodeBySubtype(correctiveActions, "vso:correctiveAction");

    if (!correctiveActionNode) {
      correctiveActionNode = findCorrectiveActionByReloadedNode(findingNode);
    }

    if (!correctiveActionNode) {
      correctiveActionNode = findCorrectiveActionByProperty(findingNode);
    }
    
    var specialtyContext = resolveSpecialtyFromNode(findingNode);

    var result = {
      finding: {
        contentType: trimProp(findingNode, "vso:contentType") || "finding",
        findingId: trimProp(findingNode, "vso:findingId") || "",
        specialtyId: specialtyContext.specialtyId,
        specialtyCode: specialtyContext.specialtyCode,
        specialtyName: specialtyContext.specialtyName,
        providerId: trimProp(findingNode, "vso:providerId"),
        providerName: trimProp(findingNode, "vso:providerName"),
        locationId: trimProp(findingNode, "vso:locationId"),
        locationCode: trimProp(findingNode, "vso:locationCode"),
        locationName: trimProp(findingNode, "vso:locationName"),
        checklistItemCode: trimProp(findingNode, "vso:checklistItemCode") ||
          (relatedChecklistItem ? trimProp(relatedChecklistItem, "vso:itemCode") : "") ||
          "",
        requirementBreached: trimProp(findingNode, "vso:requirementBreached") || "",
        icaoReference: trimProp(findingNode, "vso:icaoReference") || "",
        nationalRegulation: trimProp(findingNode, "vso:nationalRegulation") || "",
        dateIssued: toDateString(findingNode.properties["vso:dateIssued"] || findingNode.properties["vso:openedDate"]),
        submissionDeadline: toDateString(findingNode.properties["vso:submissionDeadline"]),
        findingClosureDate: toDateString(findingNode.properties["vso:findingClosureDate"]),
        lastStatusChange: toDateString(findingNode.properties["vso:lastStatusChange"]),
        resolutionDeadline: toDateString(findingNode.properties["vso:resolutionDeadline"]),
        inspectionId: trimProp(findingNode, "vso:inspectionId") || "",
        findingLevel: trimProp(findingNode, "vso:findingLevel"),
        description: clampDescription(trimProp(findingNode, "vso:description"), 2000),
        nominalRisk: relatedChecklistItem ? trimProp(relatedChecklistItem, "vso:nominalRisk") : "",
        riskClassification: trimProp(findingNode, "vso:riskClassification") || "",
        findingStatus: findingStatus,
        correctiveAction: {
          capId: correctiveActionNode ? trimProp(correctiveActionNode, "vso:capId") : "",
          proposedAction: correctiveActionNode ? trimProp(correctiveActionNode, "vso:proposedAction") : "",
          responsibleEntity: correctiveActionNode ? trimProp(correctiveActionNode, "vso:responsibleEntity") : "",
          dueDate: correctiveActionNode ? toDateString(correctiveActionNode.properties["vso:dueDate"]) : "",
          acceptanceStatus: correctiveActionNode ? trimProp(correctiveActionNode, "vso:acceptanceStatus") : ""
        }
      }
    };

    findings.push(result);
  }

  var response = {
    schemaVersion: "1.0",
    finding: findings.length > 0 ? findings[0].finding : {},
    findings: findings,
    totalMatched: matched.length,
    returned: findings.length,
    filters: {
      location: locationFilter.value,
      locationField: locationFilter.field,
      specialty: specialtyFilter.value,
      specialtyField: specialtyFilter.field,
      excludesStatus: "Closed",
      skipCount: skipCount,
      maxItems: maxItems
    }
  };

  status.code = 200;
  model.json = jsonUtils.toJSONString(response);
} catch (error) {
  logger.error("[get-open-findings] " + error.message);
  if (!model || !model.error) {
    fail(500, "Internal server error: " + error.message);
  }
}
