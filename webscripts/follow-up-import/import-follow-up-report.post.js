// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

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

// Sets error via model.json string (consumed by FTL template as ${model.json})
function fail(code, message) {
  status.code = code;
  status.message = message;
  status.redirect = true;
  model = { json: jsonUtils.toJSONString({ success: false, error: message }) };
  throw new Error(message);
}

function resolveFollowUpHelpers() {
  if (typeof __VSO_FOLLOW_UP_HELPERS !== "undefined" && __VSO_FOLLOW_UP_HELPERS) {
    return __VSO_FOLLOW_UP_HELPERS;
  }

  if (typeof importScript === "function") {
    var candidates = [
      "../common/vso-follow-up.lib.js",
      "classpath:alfresco/extension/templates/webscripts/common/vso-follow-up.lib.js"
    ];

    for (var index = 0; index < candidates.length; index++) {
      try {
        importScript(candidates[index]);
        if (typeof __VSO_FOLLOW_UP_HELPERS !== "undefined" && __VSO_FOLLOW_UP_HELPERS) {
          return __VSO_FOLLOW_UP_HELPERS;
        }
      } catch (error) {
      }
    }
  }

  return {
    normalizeCapIdentifier: function(value) {
      var normalized = trimToNull(value);
      if (normalized === null) {
        return null;
      }
      if (normalized.indexOf("CA-") === 0) {
        return normalized;
      }
      if (normalized.indexOf("CAP-") === 0) {
        return normalized.substring(4);
      }
      return normalized;
    },
    normalizeCapCandidate: function(value) {
      var normalized = trimToNull(value);
      if (normalized === null) {
        return null;
      }
      normalized = normalized.replace(/\.json$/i, "");
      return this.normalizeCapIdentifier(normalized);
    },
    padNumber: function(value, size) {
      var parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed < 0) {
        return null;
      }
      var text = String(parsed);
      while (text.length < size) {
        text = "0" + text;
      }
      return text;
    },
    extractTrailingDigits: function(value) {
      var normalized = trimToNull(value);
      if (normalized === null) {
        return null;
      }
      var match = String(normalized).match(/(\d+)$/);
      return match ? match[1] : null;
    },
    parseFindingParts: function(findingId) {
      var normalized = trimToNull(findingId);
      if (normalized === null) {
        return null;
      }
      var match = String(normalized).toUpperCase().match(/^([A-Z0-9]+)-([A-Z0-9]+)-(\d{1,})$/);
      if (!match) {
        return null;
      }
      var findingSequence = this.padNumber(match[3], 2);
      if (findingSequence === null) {
        return null;
      }
      return {
        findingId: match[1] + "-" + match[2] + "-" + findingSequence,
        reducedFindingId: match[1] + match[2] + "-" + findingSequence,
        findingSequence: findingSequence
      };
    },
    buildCorrectiveActionId: function(findingId, capValue) {
      var findingParts = this.parseFindingParts(findingId);
      var capSequence = this.padNumber(this.extractTrailingDigits(capValue), 2);
      if (!findingParts || capSequence === null) {
        return null;
      }
      return "CA-" + findingParts.reducedFindingId + "-" + capSequence;
    },
    buildFollowUpId: function(findingId, followUpSequence) {
      var findingParts = this.parseFindingParts(findingId);
      if (!findingParts) {
        return null;
      }
      var sequenceNumber = parseInt(followUpSequence, 10);
      if (isNaN(sequenceNumber) || sequenceNumber < 1 || sequenceNumber > 99) {
        return null;
      }
      var sequence = this.padNumber(sequenceNumber, 2);
      if (!sequence) {
        return null;
      }
      return "FU-" + findingParts.reducedFindingId + "-" + sequence;
    },
    parseFollowUpSequenceFromId: function(followUpId, findingId) {
      var normalizedId = trimToNull(followUpId);
      var findingParts = this.parseFindingParts(findingId);
      if (!normalizedId || !findingParts) {
        return null;
      }
      var prefix = "FU-" + findingParts.reducedFindingId + "-";
      if (normalizedId.indexOf(prefix) !== 0) {
        return null;
      }
      var suffix = normalizedId.substring(prefix.length);
      if (!/^\d{2}$/.test(suffix)) {
        return null;
      }
      var parsed = parseInt(suffix, 10);
      return isNaN(parsed) || parsed < 1 ? null : parsed;
    },
    validateClosurePolicy: function(followUpType, effectivenessConfirmed) {
      if (effectivenessConfirmed !== true) {
        return { shouldClose: false, error: null };
      }
      if (trimToNull(followUpType) !== "Closure Verification") {
        return {
          shouldClose: false,
          error: "Only Closure Verification type follow-ups can set effectivenessConfirmed to true for closure"
        };
      }
      return { shouldClose: true, error: null };
    }
  };
}

var FOLLOW_UP_HELPERS = resolveFollowUpHelpers();

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

function normalizeBoolean(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  var normalized = String(value).toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  fail(400, "Invalid boolean value for field " + fieldName + ": " + value);
}

function normalizeInteger(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  var parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    fail(400, "Invalid integer value for field " + fieldName + ": " + value);
  }

  return parsed;
}

function normalizeCapIdentifier(value) {
  return FOLLOW_UP_HELPERS.normalizeCapIdentifier(value);
}

function normalizeCapCandidate(value) {
  return FOLLOW_UP_HELPERS.normalizeCapCandidate(value);
}

function padNumber(value, size) {
  return FOLLOW_UP_HELPERS.padNumber(value, size);
}

function extractTrailingDigits(value) {
  return FOLLOW_UP_HELPERS.extractTrailingDigits(value);
}

function parseFindingParts(findingId) {
  return FOLLOW_UP_HELPERS.parseFindingParts(findingId);
}

function buildCorrectiveActionId(findingId, capValue) {
  return FOLLOW_UP_HELPERS.buildCorrectiveActionId(findingId, capValue);
}

function buildFollowUpId(findingId, followUpSequence) {
  return FOLLOW_UP_HELPERS.buildFollowUpId(findingId, followUpSequence);
}

function parseFollowUpSequenceFromId(followUpId, findingId) {
  return FOLLOW_UP_HELPERS.parseFollowUpSequenceFromId(followUpId, findingId);
}

function validateFollowUpIdFormat(followUpId, findingId) {
  if (parseFollowUpSequenceFromId(followUpId, findingId) === null) {
    fail(400, "followUpReport.followUpId must match FU-XXXXNNNYYY-MM-VV for the provided findingId");
  }
}

function normalizeDate(value, fieldName) {
  var normalized = trimToNull(value);
  if (normalized === null) {
    return null;
  }

  var parsed = new Date(normalized);
  if (isNaN(parsed.getTime())) {
    fail(400, "Invalid date for field " + fieldName + ": " + value);
  }

  return parsed;
}

function escapeLuceneValue(value) {
  return String(value).replace(/([+\-!(){}\[\]^"~*?:\\\/]|&&|\|\|)/g, "\\$1");
}

function normalizeField(value, fieldName) {
  var normalized = trimToNull(value);
  if (normalized === null) {
    fail(400, "Missing required field: " + fieldName);
  }
  return normalized;
}

function normalizeEvidence(evidencePayload) {
  if (evidencePayload === null || evidencePayload === undefined) {
    return [];
  }

  if (!Array.isArray(evidencePayload)) {
    fail(400, "followUpReport.evidenceItems must be an array");
  }

  for (var index = 0; index < evidencePayload.length; index++) {
    var evidenceItem = evidencePayload[index];
    if (!evidenceItem || typeof evidenceItem !== "object") {
      fail(400, "Invalid evidence entry at index " + index);
    }
    if (trimToNull(evidenceItem.evidenceId) === null) {
      fail(400, "Missing required evidenceId at followUpReport.evidenceItems[" + index + "]");
    }
  }

  return evidencePayload;
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
    var candidate = nodes[index];
    if (candidate && candidate.isSubType && candidate.isSubType(subtype)) {
      return candidate;
    }
  }
  return null;
}

function ensureAspect(node, aspectName) {
  if (!node.hasAspect(aspectName)) {
    node.addAspect(aspectName);
  }
}

function ensureVersionable(node) {
  if (!node.hasAspect("cm:versionable")) {
    node.addAspect("cm:versionable");
  }
}

function setTextPropertyIfPresent(node, propertyName, value) {
  var normalized = trimToNull(value);
  if (normalized !== null) {
    node.properties[propertyName] = normalized;
  }
}

function setBooleanPropertyIfPresent(node, propertyName, value) {
  if (value !== null && value !== undefined) {
    node.properties[propertyName] = value;
  }
}

function setIntPropertyIfPresent(node, propertyName, value) {
  if (value !== null && value !== undefined) {
    node.properties[propertyName] = value;
  }
}

function setDatePropertyIfPresent(node, propertyName, value) {
  if (value !== null && value !== undefined) {
    node.properties[propertyName] = value;
  }
}

function assocContains(nodeCollection, candidate) {
  if (!nodeCollection || !candidate) {
    return false;
  }

  for (var index = 0; index < nodeCollection.length; index++) {
    if (String(nodeCollection[index].nodeRef) === String(candidate.nodeRef)) {
      return true;
    }
  }

  return false;
}

function ensureAssociation(sourceNode, targetNode, assocType) {
  var existing = sourceNode.assocs[assocType];
  if (!assocContains(existing, targetNode)) {
    sourceNode.createAssociation(targetNode, assocType);
  }
}

function toContext(node) {
  return {
    inspectionId: trimProp(node, "vso:inspectionId"),
    locationId: trimProp(node, "vso:locationId"),
    locationCode: trimProp(node, "vso:locationCode"),
    locationName: trimProp(node, "vso:locationName"),
    specialtyId: trimProp(node, "vso:specialtyId"),
    specialtyCode: trimProp(node, "vso:specialtyCode"),
    specialtyName: trimProp(node, "vso:specialtyName"),
    providerId: trimProp(node, "vso:providerId"),
    providerName: trimProp(node, "vso:providerName")
  };
}

function buildEvidenceSearchQuery(evidencePayload, context) {
  var clauses = ["+TYPE:\"vso:evidenceItem\""];
  clauses.push("+@vso\\:evidenceId:\"" + escapeLuceneValue(evidencePayload.evidenceId) + "\"");

  var source = trimToNull(evidencePayload.evidenceSource);
  if (source) {
    clauses.push("+@vso\\:source:\"" + escapeLuceneValue(source) + "\"");
  }

  if (context.providerId) {
    clauses.push("+@vso\\:providerId:\"" + escapeLuceneValue(context.providerId) + "\"");
  }
  if (context.locationId) {
    clauses.push("+@vso\\:locationId:\"" + escapeLuceneValue(context.locationId) + "\"");
  }
  if (context.specialtyId) {
    clauses.push("+@vso\\:specialtyId:\"" + escapeLuceneValue(context.specialtyId) + "\"");
  }

  return clauses.join(" ");
}

function chooseEvidenceCandidate(candidates, evidencePayload) {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  var source = trimToNull(evidencePayload.evidenceSource);
  var exactSourceMatches = [];

  for (var index = 0; index < candidates.length; index++) {
    var candidate = candidates[index];
    if (!candidate || !candidate.isSubType || !candidate.isSubType("vso:evidenceItem")) {
      continue;
    }

    if (!source) {
      exactSourceMatches.push(candidate);
      continue;
    }

    var candidateSource = trimProp(candidate, "vso:source");
    if (candidateSource && candidateSource === source) {
      exactSourceMatches.push(candidate);
    }
  }

  if (exactSourceMatches.length === 1) {
    return exactSourceMatches[0];
  }

  return exactSourceMatches.length > 0 ? exactSourceMatches[0] : null;
}

function findEvidenceNode(evidencePayload, context) {
  var strictQuery = buildEvidenceSearchQuery(evidencePayload, context);
  var strictMatches = search.luceneSearch(strictQuery) || [];
  var strictCandidate = chooseEvidenceCandidate(strictMatches, evidencePayload);
  if (strictCandidate) {
    return strictCandidate;
  }

  var fallbackQuery = "+TYPE:\"vso:evidenceItem\" +@vso\\:evidenceId:\"" + escapeLuceneValue(evidencePayload.evidenceId) + "\"";
  var fallbackMatches = search.luceneSearch(fallbackQuery) || [];
  return chooseEvidenceCandidate(fallbackMatches, evidencePayload);
}

function linkFollowUpEvidence(followUpNode, evidencePayloads, context, summary) {
  var unresolved = [];
  var linked = 0;

  for (var index = 0; index < evidencePayloads.length; index++) {
    var evidencePayload = evidencePayloads[index];
    var evidenceNode = findEvidenceNode(evidencePayload, context);

    if (!evidenceNode) {
      unresolved.push({
        evidenceId: evidencePayload.evidenceId,
        evidenceSource: trimToNull(evidencePayload.evidenceSource)
      });
      continue;
    }

    ensureAssociation(followUpNode, evidenceNode, "vso:relatedEvidence");
    linked += 1;
  }

  summary.evidenceLinked = linked;
  summary.evidenceUnresolved = unresolved.length;

  return unresolved;
}

function buildFindingSearchQuery(request) {
  var clauses = ["+TYPE:\"vso:finding\""];
  clauses.push("+@vso\\:findingId:\"" + escapeLuceneValue(request.findingId) + "\"");

  if (request.providerId) {
    clauses.push("+@vso\\:providerId:\"" + escapeLuceneValue(request.providerId) + "\"");
  }
  if (request.locationId) {
    clauses.push("+@vso\\:locationId:\"" + escapeLuceneValue(request.locationId) + "\"");
  }
  if (request.specialtyId) {
    clauses.push("+@vso\\:specialtyId:\"" + escapeLuceneValue(request.specialtyId) + "\"");
  }

  return clauses.join(" ");
}

function findFindingNode(request) {
  var query = buildFindingSearchQuery(request);
  var matches = search.luceneSearch(query) || [];

  if (matches.length === 0) {
    fail(404, "Finding not found for findingId: " + request.findingId);
  }

  if (matches.length > 1) {
    fail(409, "Multiple findings matched findingId " + request.findingId + ". Provide providerId/locationId/specialtyId to disambiguate.");
  }

  var findingNode = selectFirstNodeBySubtype(matches, "vso:finding");
  if (!findingNode) {
    fail(404, "No vso:finding node found for findingId: " + request.findingId);
  }

  return findingNode;
}

function findCorrectiveActionNode(findingNode, capId) {
  var normalizedCapId = normalizeCapIdentifier(capId);
  var normalizedCapSequence = padNumber(extractTrailingDigits(normalizedCapId), 2);
  var candidates = collectAssocNodesByShortName(findingNode, "hasCorrectiveAction");

  if ((!candidates || candidates.length === 0) && findingNode.children) {
    candidates = findingNode.children;
  }

  for (var index = 0; index < candidates.length; index++) {
    var candidate = candidates[index];
    if (!candidate || !candidate.isSubType || !candidate.isSubType("vso:correctiveAction")) {
      continue;
    }

    var candidateCapId = normalizeCapCandidate(trimProp(candidate, "vso:capId") || trimToNull(candidate.name));
    var candidateCapSequence = padNumber(extractTrailingDigits(candidateCapId), 2);

    if (candidateCapId === normalizedCapId) {
      return candidate;
    }

    if (normalizedCapSequence !== null && candidateCapSequence === normalizedCapSequence) {
      return candidate;
    }
  }

  return null;
}

function toNodePath(node) {
  return node.displayPath + "/" + node.name;
}

function generateFollowUpSequence(findingNode, findingId) {
  var existingFollowUps = collectAssocNodesByShortName(findingNode, "hasFollowUp");
  if (!existingFollowUps || existingFollowUps.length === 0) {
    return 1;
  }

  var maxSequence = 0;
  for (var index = 0; index < existingFollowUps.length; index++) {
    var followUpNode = existingFollowUps[index];
    if (!followUpNode || !followUpNode.properties) {
      continue;
    }

    var seq = parseFollowUpSequenceFromId(followUpNode.properties["vso:followUpId"], findingId);
    if (seq !== null && seq > maxSequence) {
      maxSequence = seq;
    }
  }

  return maxSequence + 1;
}

function ensureCorrectiveActionNode(findingNode, payload, findingContext, summary) {
  if (!payload.capId) {
    return { node: null, created: false };
  }

  var capId = normalizeCapIdentifier(payload.capId);
  var correctiveActionNode = findCorrectiveActionNode(findingNode, capId);
  var created = false;

  if (!correctiveActionNode) {
    correctiveActionNode = findingNode.createNode(capId + ".json", "vso:correctiveAction", "vso:hasCorrectiveAction");
    created = true;
  }

  ensureVersionable(correctiveActionNode);
  ensureAspect(correctiveActionNode, "vso:inspectionContext");
  ensureAspect(correctiveActionNode, "vso:serviceContext");

  setTextPropertyIfPresent(correctiveActionNode, "cm:title", capId);
  setTextPropertyIfPresent(correctiveActionNode, "vso:contentType", "correctiveAction");
  setTextPropertyIfPresent(correctiveActionNode, "vso:capId", capId);

  setTextPropertyIfPresent(correctiveActionNode, "vso:inspectionId", findingContext.inspectionId);
  setTextPropertyIfPresent(correctiveActionNode, "vso:locationId", payload.locationId || findingContext.locationId);
  setTextPropertyIfPresent(correctiveActionNode, "vso:locationName", payload.locationName || findingContext.locationName);
  setTextPropertyIfPresent(correctiveActionNode, "vso:specialtyId", payload.specialtyId || findingContext.specialtyId);
  setTextPropertyIfPresent(correctiveActionNode, "vso:providerId", payload.providerId || findingContext.providerId);

  correctiveActionNode.save();

  if (created) {
    summary.created += 1;
  } else {
    summary.updated += 1;
  }

  return { node: correctiveActionNode, created: created };
}

function sanitizeToken(value) {
  var cleaned = String(value).replace(/[^A-Za-z0-9._-]+/g, "-");
  cleaned = cleaned.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "unknown";
}

function buildFollowUpNodeName(payload) {
  return sanitizeToken(payload.followUpId) + ".json";
}

function ensureFollowUpNode(findingNode, payload, rawPayload, correctiveActionNode, summary) {
  var nodeName = buildFollowUpNodeName(payload);
  var followUpNode = findingNode.childByNamePath(nodeName);
  var created = false;

  if (!followUpNode || !followUpNode.exists()) {
    followUpNode = findingNode.createNode(nodeName, "vso:followUpReport", "vso:hasFollowUp");
    created = true;
  }

  ensureVersionable(followUpNode);
  ensureAspect(followUpNode, "vso:inspectionContext");
  ensureAspect(followUpNode, "vso:serviceContext");

  followUpNode.content = JSON.stringify(rawPayload, null, 2);
  followUpNode.mimetype = "text/plain";

  var findingContext = toContext(findingNode);
  setTextPropertyIfPresent(followUpNode, "cm:title", "Follow-up " + payload.followUpId);
  setTextPropertyIfPresent(followUpNode, "vso:contentType", "followUpReport");
  setTextPropertyIfPresent(followUpNode, "vso:followUpType", payload.followUpType);
  setDatePropertyIfPresent(followUpNode, "vso:followUpDate", new Date(payload.followUpDate));
  setIntPropertyIfPresent(followUpNode, "vso:percentComplete", payload.percentComplete);
  setTextPropertyIfPresent(followUpNode, "vso:currentResidualRisk", payload.currentResidualRisk);
  setDatePropertyIfPresent(followUpNode, "vso:followUpClosureDate", normalizeDate(payload.followUpClosureDate, "followUpReport.followUpClosureDate"));
  setTextPropertyIfPresent(followUpNode, "vso:closureVerificationMethod", payload.closureVerificationMethod);
  setBooleanPropertyIfPresent(followUpNode, "vso:effectivenessConfirmed", payload.effectivenessConfirmed);

  setTextPropertyIfPresent(followUpNode, "vso:followUpId", payload.followUpId);
  setTextPropertyIfPresent(followUpNode, "vso:followUpComment", payload.followUpComment);
  setTextPropertyIfPresent(followUpNode, "vso:inspectionId", findingContext.inspectionId);
  setTextPropertyIfPresent(followUpNode, "vso:locationId", payload.locationId || findingContext.locationId);
  setTextPropertyIfPresent(followUpNode, "vso:locationName", payload.locationName || findingContext.locationName);
  setTextPropertyIfPresent(followUpNode, "vso:specialtyId", payload.specialtyId || findingContext.specialtyId);
  setTextPropertyIfPresent(followUpNode, "vso:providerId", payload.providerId || findingContext.providerId);

  if (correctiveActionNode) {
    ensureAssociation(followUpNode, correctiveActionNode, "vso:relatedCorrectiveAction");
  }

  followUpNode.save();

  if (created) {
    summary.created += 1;
  } else {
    summary.updated += 1;
  }

  return { node: followUpNode, created: created };
}

function updateFindingStatusFromFollowUp(findingNode, payload) {
  var closurePolicy = FOLLOW_UP_HELPERS.validateClosurePolicy(payload.followUpType, payload.effectivenessConfirmed);
  if (closurePolicy.error) {
    fail(400, closurePolicy.error);
  }

  if (!closurePolicy.shouldClose) {
    return false;
  }

  ensureAspect(findingNode, "vso:inspectionContext");
  ensureAspect(findingNode, "vso:serviceContext");

  if (payload.currentResidualRisk) {
    findingNode.properties["vso:achievedResidualRisk"] = payload.currentResidualRisk;
  }
  findingNode.properties["vso:findingStatus"] = "Pending Closure Approval";
  findingNode.properties["vso:findingClosureDate"] = normalizeDate(payload.followUpClosureDate || payload.followUpDate, "followUpReport.followUpDate");
  findingNode.properties["vso:lastStatusChange"] = new Date();
  findingNode.save();
  return true;
}

function normalizeRequest(payloadRoot) {
  if (!payloadRoot.followUpReport || typeof payloadRoot.followUpReport !== "object") {
    fail(400, "Missing required object: followUpReport");
  }

  var report = payloadRoot.followUpReport;

  var normalized = {
    schemaVersion: trimToNull(payloadRoot.schemaVersion) || "1.0",
    findingId: normalizeField(report.findingId, "followUpReport.findingId"),
    providerId: trimToNull(report.providerId),
    locationId: trimToNull(report.locationId),
    locationName: trimToNull(report.locationName),
    specialtyId: trimToNull(report.specialtyId),
    capId: trimToNull(report.capId),
    followUpType: normalizeField(report.followUpType, "followUpReport.followUpType"),
    followUpDate: normalizeField(report.followUpDate, "followUpReport.followUpDate"),
    percentComplete: normalizeInteger(report.percentComplete, "followUpReport.percentComplete"),
    effectivenessConfirmed: normalizeBoolean(report.effectivenessConfirmed, "followUpReport.effectivenessConfirmed"),
    followUpClosureDate: trimToNull(report.followUpClosureDate),
    closureVerificationMethod: trimToNull(report.closureVerificationMethod),
    followUpId: trimToNull(report.followUpId),
    followUpComment: trimToNull(report.followUpComment),
    evidenceItems: normalizeEvidence(report.evidenceItems)
  };

  normalizeDate(normalized.followUpDate, "followUpReport.followUpDate");

  var normalizedFinding = parseFindingParts(normalized.findingId);
  if (!normalizedFinding) {
    fail(400, "followUpReport.findingId must match XXXXNNN-YYY-MM");
  }
  normalized.findingId = normalizedFinding.findingId;

  if (normalized.capId !== null) {
    normalized.capId = buildCorrectiveActionId(normalized.findingId, normalized.capId) || normalizeCapIdentifier(normalized.capId);
    if (normalized.capId === null || normalized.capId.indexOf("CA-") !== 0) {
      fail(400, "followUpReport.capId must contain a corrective action sequence to build CA-XXXXNNNYYY-MM-SS");
    }
  }

  if (normalized.followUpId !== null) {
    validateFollowUpIdFormat(normalized.followUpId, normalized.findingId);
  }

  if (normalized.percentComplete !== null && (normalized.percentComplete < 0 || normalized.percentComplete > 100)) {
    fail(400, "followUpReport.percentComplete must be between 0 and 100");
  }

  return normalized;
}

try {
  var parsed = parsePayload(requestbody.content);
  var normalizedRequest = normalizeRequest(parsed);
  var summary = {
    created: 0,
    updated: 0,
    evidenceItemsInPayload: normalizedRequest.evidenceItems.length,
    evidenceLinked: 0,
    evidenceUnresolved: 0
  };

  var findingNode = findFindingNode(normalizedRequest);
  var findingContext = toContext(findingNode);

  if (normalizedRequest.followUpId === null) {
    normalizedRequest.followUpId = buildFollowUpId(
      normalizedRequest.findingId,
      generateFollowUpSequence(findingNode, normalizedRequest.findingId)
    );
    if (normalizedRequest.followUpId === null) {
      fail(400, "Unable to build followUpReport.followUpId from findingId and follow-up sequence");
    }
    parsed.followUpReport.followUpId = normalizedRequest.followUpId;
  }

  var correctiveActionResult = ensureCorrectiveActionNode(findingNode, normalizedRequest, findingContext, summary);
  var followUpResult = ensureFollowUpNode(
    findingNode,
    normalizedRequest,
    parsed.followUpReport,
    correctiveActionResult.node,
    summary
  );
  var unresolvedEvidence = linkFollowUpEvidence(followUpResult.node, normalizedRequest.evidenceItems, {
    providerId: normalizedRequest.providerId || findingContext.providerId,
    locationId: normalizedRequest.locationId || findingContext.locationId,
    specialtyId: normalizedRequest.specialtyId || findingContext.specialtyId
  }, summary);
  var findingClosedByImport = updateFindingStatusFromFollowUp(findingNode, normalizedRequest);

  var response = {
    success: true,
    schemaVersion: normalizedRequest.schemaVersion,
    summary: summary,
    findingClosedByImport: findingClosedByImport,
    finding: {
      findingId: normalizedRequest.findingId,
      nodeRef: String(findingNode.nodeRef),
      path: toNodePath(findingNode),
      status: trimProp(findingNode, "vso:findingStatus")
    },
    correctiveAction: correctiveActionResult.node ? {
      capId: normalizeCapIdentifier(normalizedRequest.capId),
      nodeRef: String(correctiveActionResult.node.nodeRef),
      path: toNodePath(correctiveActionResult.node),
      created: correctiveActionResult.created
    } : null,
    followUpReport: {
      nodeName: followUpResult.node.name,
      nodeRef: String(followUpResult.node.nodeRef),
      path: toNodePath(followUpResult.node),
      created: followUpResult.created
    },
    unresolvedEvidence: unresolvedEvidence
  };

  status.code = 200;
  model.json = jsonUtils.toJSONString(response);
} catch (error) {
  logger.error("[import-follow-up-report] " + error.message);
  if (!model || !model.json) {
    fail(500, "Internal server error: " + error.message);
  }
}
