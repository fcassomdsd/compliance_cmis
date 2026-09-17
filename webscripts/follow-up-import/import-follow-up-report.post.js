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

// Mutation endpoints allow Alfresco administrators and any member of the
// groups listed in __VSO_SECURITY.mutationGroups (see
// webscripts/common/vso-security.lib.js); values are fully-qualified
// cm:authorityName values.

// Resolve the mutation-group allowlist. Mirrors the __VSO_PATHS pattern: try
// to import the shared library, then fall back to an inline copy because
// importScript is not available in every Web Script execution context.
function resolveVsoSecurity() {
  if (typeof __VSO_SECURITY !== "undefined" && __VSO_SECURITY) {
    return __VSO_SECURITY;
  }

  var defaults = { mutationGroups: ["GROUP_U-VSO-WS_MUTATORS"] };

  if (typeof importScript === "function") {
    var candidates = [
      "../common/vso-security.lib.js",
      "classpath:alfresco/extension/templates/webscripts/common/vso-security.lib.js"
    ];

    for (var index = 0; index < candidates.length; index++) {
      try {
        importScript(candidates[index]);
        if (typeof __VSO_SECURITY !== "undefined" && __VSO_SECURITY) {
          return __VSO_SECURITY;
        }
      } catch (error) {
      }
    }
  }

  return defaults;
}

function requireMutationAccess(operation) {
  if (people.isAdmin(person)) {
    return;
  }

  var allowed = [];
  var security = resolveVsoSecurity();
  if (security && security.mutationGroups) {
    allowed = security.mutationGroups;
  }

  if (allowed.length > 0) {
    var groups = people.getContainerGroups(person) || [];
    for (var i = 0; i < groups.length; i++) {
      var authority = groups[i] && groups[i].properties ? groups[i].properties["cm:authorityName"] : null;
      for (var j = 0; j < allowed.length; j++) {
        if (authority === allowed[j]) {
          return;
        }
      }
    }
  }

  fail(403, "Access denied: " + operation +
    " requires an Alfresco administrator or a member of a configured mutation group.");
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
      if (normalized.indexOf("P-") === 0) {
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
      var match = String(normalized).toUpperCase().match(/^(?:H-)?([A-Z0-9]+)-([A-Z0-9]+)-(\d{1,3})$/);
      if (!match) {
        return null;
      }
      var findingSequence = this.padNumber(match[3], 3);
      if (findingSequence === null) {
        return null;
      }
      return {
        findingId: "H-" + match[1] + "-" + match[2] + "-" + findingSequence,
        reducedFindingId: match[1] + "-" + match[2] + findingSequence,
        findingSequence: findingSequence
      };
    },
    buildCorrectiveActionId: function(findingId, capValue) {
      var findingParts = this.parseFindingParts(findingId);
      var capSequence = this.padNumber(this.extractTrailingDigits(capValue), 2);
      if (!findingParts || capSequence === null) {
        return null;
      }
      return "P-" + findingParts.reducedFindingId + "-" + capSequence;
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
      return "S-" + findingParts.reducedFindingId + "-" + sequence;
    },
    parseFollowUpSequenceFromId: function(followUpId, findingId) {
      var normalizedId = trimToNull(followUpId);
      var findingParts = this.parseFindingParts(findingId);
      if (!normalizedId || !findingParts) {
        return null;
      }
      var prefix = "S-" + findingParts.reducedFindingId + "-";
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
    fail(400, "followUpReport.followUpId must match S-XXXXT####-EEE###-## for the provided findingId");
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

// Canonical nodes are written by the service identity, so cm:creator names the
// service rather than the inspector. Copy the operator attribution that
// compliance_import verified and stamped onto the ingested payload.
function applyOperatorAttribution(node, payload) {
  if (!node || !payload) {
    return;
  }

  ensureAspect(node, "vso:operatorAttribution");
  setTextPropertyIfPresent(node, "vso:enteredBy", payload.enteredBy);
  setTextPropertyIfPresent(node, "vso:enteredByDisplayName", payload.enteredByDisplayName);
  setDatePropertyIfPresent(node, "vso:enteredAt", payload.enteredAt);
  setTextPropertyIfPresent(node, "vso:inspectorId", payload.inspectorId);
  setTextPropertyIfPresent(node, "vso:enteredVia", payload.enteredVia);
  setTextPropertyIfPresent(node, "vso:declaredBy", payload.declaredBy);
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
  var strictMatches = searchCapped(strictQuery) || [];
  var strictCandidate = chooseEvidenceCandidate(strictMatches, evidencePayload);
  if (strictCandidate) {
    return strictCandidate;
  }

  var fallbackQuery = "+TYPE:\"vso:evidenceItem\" +@vso\\:evidenceId:\"" + escapeLuceneValue(evidencePayload.evidenceId) + "\"";
  var fallbackMatches = searchCapped(fallbackQuery) || [];
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

// Path configuration is centralized.
// Maintain folder paths in README.md -> "Path configuration (Alfresco)" and webscripts/common/vso-paths.lib.js.
function resolveVsoPaths() {
  var defaults = {
    findingBasePath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Hallazgos"
  };

  if (typeof __VSO_PATHS !== "undefined" && __VSO_PATHS) {
    return __VSO_PATHS;
  }

  if (typeof importScript === "function") {
    var candidates = [
      "../common/vso-paths.lib.js",
      "classpath:alfresco/extension/templates/webscripts/common/vso-paths.lib.js"
    ];

    for (var index = 0; index < candidates.length; index++) {
      try {
        importScript(candidates[index]);
        if (typeof __VSO_PATHS !== "undefined" && __VSO_PATHS) {
          return __VSO_PATHS;
        }
      } catch (error) {
      }
    }
  }

  return defaults;
}

var VSO_PATHS = resolveVsoPaths();

// Findings are filed at deterministic paths -- Hallazgos/<year>/<findingId>.json
// (see import-canonical-models.post.js's upsertFinding) -- so a node lookup by
// path resolves instantly against the repository itself. The AFTS/Lucene search
// findFindingNode() falls back to below only lags behind writes by design (index
// commit interval), so importing a checklist and then its follow-up seconds later
// can answer "not found" for a finding that unquestionably exists. Enumerating the
// (typically few) year folders and trying childByNamePath in each avoids the
// index entirely for the common case; only a finding filed somewhere unexpected
// falls through to the search.
//
// The filename is NOT stable at ".json": import-canonical-models.post.js's
// replaceContentWithPdf() renames the node to <findingId>.pdf the moment its PDF
// renders, synchronously within the same request that creates it -- so by the
// time any later request looks it up, it is normally already <findingId>.pdf.
// Both extensions are tried; .pdf first, since that is the state a finding is in
// for the rest of its life.
function findFindingNodeByPath(findingId) {
  var findingsBaseFolder = companyhome.childByNamePath(VSO_PATHS.findingBasePath);
  if (!findingsBaseFolder || !findingsBaseFolder.exists()) {
    return [];
  }

  var yearFolders = findingsBaseFolder.children || [];
  var matches = [];
  var fileNames = [findingId + ".pdf", findingId + ".json"];

  for (var index = 0; index < yearFolders.length; index++) {
    var yearFolder = yearFolders[index];
    if (!yearFolder || !yearFolder.isContainer) {
      continue;
    }

    for (var nameIndex = 0; nameIndex < fileNames.length; nameIndex++) {
      var candidate = yearFolder.childByNamePath(fileNames[nameIndex]);
      if (candidate && candidate.exists() && candidate.isSubType && candidate.isSubType("vso:finding")) {
        matches.push(candidate);
        break;
      }
    }
  }

  return matches;
}

function findFindingNode(request) {
  var matches = findFindingNodeByPath(request.findingId);

  if (matches.length === 0) {
    var query = buildFindingSearchQuery(request);
    matches = searchCapped(query) || [];
  }

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
  applyOperatorAttribution(followUpNode, payload);

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
  // A declaration only makes the finding eligible; the closure date is written by the review
  // route (compliance_web's PATCH /findings/:findingId/closure-review) when a reviewer
  // approves. Stamping `followUpClosureDate || followUpDate` here dated the closure before
  // anyone approved it, and because nothing cleared it the date then survived a rejection —
  // leaving an In Progress finding that read as closed. Clearing it keeps this path in step
  // with the canonical import.
  findingNode.properties["vso:findingClosureDate"] = null;
  // Record who declared it, exactly as the canonical import does. Never inherit: a name left
  // by a superseded declaration would attribute this closure to someone who did not declare
  // it, and separation of duties hangs off that field — the review refuses a finding with no
  // recorded declarer rather than trusting an unattributable one.
  findingNode.properties["vso:closureRequestedBy"] =
    trimToNull(payload.enteredBy) || trimToNull(payload.declaredBy);
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
    // Carried for the closure declaration below, which records who declared it. Dropping them
    // here is what made this path unable to attribute a closure to anybody.
    enteredBy: trimToNull(report.enteredBy),
    declaredBy: trimToNull(report.declaredBy),
    evidenceItems: normalizeEvidence(report.evidenceItems)
  };

  normalizeDate(normalized.followUpDate, "followUpReport.followUpDate");

  var normalizedFinding = parseFindingParts(normalized.findingId);
  if (!normalizedFinding) {
    fail(400, "followUpReport.findingId must match H-XXXXT####-EEE-###");
  }
  normalized.findingId = normalizedFinding.findingId;

  if (normalized.capId !== null) {
    normalized.capId = buildCorrectiveActionId(normalized.findingId, normalized.capId) || normalizeCapIdentifier(normalized.capId);
    if (normalized.capId === null || normalized.capId.indexOf("P-") !== 0) {
      fail(400, "followUpReport.capId must contain a corrective action sequence to build P-XXXXT####-EEE###-##");
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
  requireMutationAccess("importing follow-up reports");
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
