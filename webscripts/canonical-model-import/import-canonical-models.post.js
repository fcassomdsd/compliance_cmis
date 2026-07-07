// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

// Path configuration is centralized.
// Maintain folder paths in README.md -> "Path configuration (Alfresco)" and webscripts/common/vso-paths.lib.js.
function resolveVsoPaths() {
  var defaults = {
    inspectionInProcessPath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Inspecciones",
    canonicalSourceBasePath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Datos de campo",
    findingBasePath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Hallazgos",
    inspectionPlanTemplateDataPath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Template data"
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
var DEFAULT_SOURCE_BASE_PATH = VSO_PATHS.canonicalSourceBasePath;
var DEFAULT_DESTINATION_BASE_PATH = VSO_PATHS.inspectionInProcessPath;
var DEFAULT_FINDINGS_BASE_PATH = VSO_PATHS.findingBasePath || "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Hallazgos";
// Use text/plain so Share can preview JSON content inline.
var JSON_MIMETYPE = "text/plain";

function setError(code, message) {
  status.code = code;
  status.message = message;
  status.redirect = true;
  model.success = false;
  model.error = message;
  model.inspection = null;
  model.summary = null;
  model.importedSources = [];
}

// Sets error via model properties (consumed by FTL template as ${success}, ${error}, etc.)
function fail(code, message) {
  setError(code, message);
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

function trimToNull(value) {
  if (value === null || value === undefined) {
    return null;
  }

  var normalized = String(value).replace(/^\s+|\s+$/g, "");
  return normalized.length === 0 ? null : normalized;
}

function escapeLuceneValue(value) {
  return String(value).replace(/([+\-!(){}\[\]^"~*?:\\\/]|&&|\|\|)/g, "\\$1");
}

function normalizeBooleanFlag(value) {
  if (value === true || value === false) {
    return value;
  }

  var normalized = trimToNull(value);
  if (normalized === null) {
    return null;
  }

  normalized = normalized.toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return null;
}

function sanitizeUpperToken(value) {
  var normalized = trimToNull(value);
  if (normalized === null) {
    return null;
  }

  var cleaned = String(normalized).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length === 0 ? null : cleaned;
}

function padNumber(value, size) {
  var parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) {
    return null;
  }

  var asText = String(parsed);
  while (asText.length < size) {
    asText = "0" + asText;
  }
  return asText;
}

function extractTrailingDigits(value) {
  var normalized = trimToNull(value);
  if (normalized === null) {
    return null;
  }

  var match = String(normalized).match(/(\d+)$/);
  return match ? match[1] : null;
}

function resolveInspectionKey(source, importRequest) {
  var inspectionSeed = firstNonEmpty(
    source ? source.inspectionId : null,
    source ? source.inspectionCode : null,
    importRequest ? importRequest.inspectionId : null,
    importRequest ? importRequest.inspectionCode : null
  );

  var preferredLocationCode = sanitizeUpperToken(firstNonEmpty(
    source ? source.locationCode : null,
    source ? source.icaoCode : null,
    importRequest ? importRequest.locationCode : null,
    importRequest ? importRequest.icaoCode : null
  ));

  var seedText = trimToNull(inspectionSeed);
  if (seedText !== null) {
    var hyphenMatch = String(seedText).toUpperCase().match(/^([A-Z]{4})-(\d{1,})$/);
    if (hyphenMatch) {
      var directSeq = padNumber(hyphenMatch[2], 3);
      if (directSeq !== null) {
        return {
          locationCode: hyphenMatch[1],
          sequence: directSeq
        };
      }
    }

    var compactMatch = String(seedText).toUpperCase().match(/^([A-Z]{4})(\d{3})$/);
    if (compactMatch) {
      return {
        locationCode: compactMatch[1],
        sequence: compactMatch[2]
      };
    }
  }

  var sequenceFromSeed = padNumber(extractTrailingDigits(seedText), 3);
  if (preferredLocationCode && sequenceFromSeed) {
    return {
      locationCode: preferredLocationCode.substring(0, 4),
      sequence: sequenceFromSeed
    };
  }

  return null;
}

function buildInspectionId(key) {
  if (!key) {
    return null;
  }
  return key.locationCode + "-" + key.sequence;
}

function buildInspectionCompactId(key) {
  if (!key) {
    return null;
  }
  return key.locationCode + key.sequence;
}

function resolveSpecialtyToken(source, importRequest) {
  return sanitizeUpperToken(firstNonEmpty(
    source ? source.specialtyCode : null,
    source ? source.specialtyId : null,
    importRequest ? importRequest.specialtyCode : null,
    importRequest ? importRequest.specialtyId : null
  ));
}

function buildChecklistId(inspectionCompactId, specialtyToken) {
  if (!inspectionCompactId || !specialtyToken) {
    return null;
  }
  return "CHK-" + inspectionCompactId + "-" + specialtyToken;
}

function resolveFindingSequence(findingPayload, fallbackSequence) {
  var fromFindingId = padNumber(extractTrailingDigits(findingPayload ? findingPayload.findingId : null), 2);
  if (fromFindingId !== null) {
    return fromFindingId;
  }

  return padNumber(fallbackSequence, 2);
}

function buildFindingId(inspectionCompactId, specialtyToken, findingSequence) {
  if (!inspectionCompactId || !specialtyToken || !findingSequence) {
    return null;
  }
  return inspectionCompactId + "-" + specialtyToken + "-" + findingSequence;
}

function normalizeChecklistIdentity(checklistPayload, importRequest) {
  var inspectionKey = resolveInspectionKey(checklistPayload, importRequest);
  if (!inspectionKey) {
    return null;
  }

  var specialtyToken = resolveSpecialtyToken(checklistPayload, importRequest);
  if (!specialtyToken) {
    return null;
  }

  var inspectionId = buildInspectionId(inspectionKey);
  var inspectionCompactId = buildInspectionCompactId(inspectionKey);
  var checklistId = buildChecklistId(inspectionCompactId, specialtyToken);

  checklistPayload.inspectionId = inspectionId;
  checklistPayload.inspectionCode = inspectionId;
  checklistPayload.checklistId = checklistId;

  return {
    inspectionId: inspectionId,
    inspectionCompactId: inspectionCompactId,
    specialtyToken: specialtyToken,
    checklistId: checklistId
  };
}

function normalizeFindingIdentity(findingPayload, identityContext, fallbackSequence) {
  if (!findingPayload || !identityContext) {
    return;
  }

  var findingSequence = resolveFindingSequence(findingPayload, fallbackSequence);
  if (findingSequence === null) {
    return;
  }

  var findingId = buildFindingId(identityContext.inspectionCompactId, identityContext.specialtyToken, findingSequence);
  if (findingId !== null) {
    findingPayload.findingId = findingId;
  }
}

function setPropertyIfPresent(node, propertyName, value) {
  var normalized = trimToNull(value);
  if (normalized !== null) {
    node.properties[propertyName] = normalized;
  }
}

function setDatePropertyIfPresent(node, propertyName, value) {
  var normalized = trimToNull(value);
  if (normalized !== null) {
    node.properties[propertyName] = normalized;
  }
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

function ensureFolder(baseFolder, folderName, folderType) {
  var folder = baseFolder.childByNamePath(folderName);

  if (folder && folder.exists()) {
    if (!folder.isContainer) {
      fail(409, "Destination already exists and is not a folder: " + folderName);
    }
    if (folderType && !folder.isSubType(folderType)) {
      folder.specializeType(folderType);
    }
    return { node: folder, created: false };
  }

  return {
    node: folderType ? baseFolder.createFolder(folderName, folderType) : baseFolder.createFolder(folderName),
    created: true
  };
}

function ensureChildNode(parentNode, nodeName, nodeType, assocType) {
  var childNode = parentNode.childByNamePath(nodeName);

  if (childNode && childNode.exists()) {
    if (!childNode.isSubType(nodeType)) {
      childNode.specializeType(nodeType);
    }
    return { node: childNode, created: false };
  }

  return {
    node: parentNode.createNode(nodeName, nodeType, assocType),
    created: true
  };
}

function findDocumentByName(parentNode, nodeName) {
  var childNode = parentNode.childByNamePath(nodeName);
  if (childNode && childNode.exists()) {
    return childNode;
  }
  return null;
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

function normalizeComplianceStatus(value) {
  var normalized = trimToNull(value);
  if (normalized === null) {
    return null;
  }

  var lowerValue = normalized.toLowerCase();
  if (lowerValue === "compliant") {
    return "Compliant";
  }
  if (lowerValue === "non-compliant" || lowerValue === "non compliant" || lowerValue === "non-compliance" || lowerValue === "non-compliant") {
    return "Non-Compliant";
  }
  if (lowerValue === "not applicable" || lowerValue === "not-applicable") {
    return "Not Applicable";
  }

  return normalized;
}

function normalizeFindingLevel(value) {
  var normalized = trimToNull(value);
  if (normalized === null) {
    return "Non-Compliance";
  }

  var lowerValue = normalized.toLowerCase();
  if (lowerValue === "non-compliance" || lowerValue === "non compliance" || lowerValue === "non-compliant") {
    return "Non-Compliance";
  }
  if (lowerValue === "observation") {
    return "Observation";
  }
  if (lowerValue === "recommendation") {
    return "Recommendation";
  }

  return normalized;
}

function buildJsonContent(payload) {
  return JSON.stringify(payload, null, 2);
}

function parseJsonContent(node) {
  try {
    return JSON.parse(String(node.content));
  } catch (error) {
    fail(400, "Invalid JSON in canonical model " + node.name + ": " + error.message);
  }
}

function validateImportRequest(requestBody) {
  if (!requestBody || typeof requestBody !== "object") {
    fail(400, "Request body must be a JSON object");
  }

  var inspectionCode = trimToNull(requestBody.inspectionCode);

  if (inspectionCode === null) {
    fail(400, "Missing required field: inspectionCode");
  }

  return {
    inspectionCode: inspectionCode,
    inspectionId: trimToNull(requestBody.inspectionId),
    sourceBasePath: trimToNull(requestBody.sourceBasePath) || DEFAULT_SOURCE_BASE_PATH,
    destinationBasePath: trimToNull(requestBody.destinationBasePath) || DEFAULT_DESTINATION_BASE_PATH,
    findingsBasePath: trimToNull(requestBody.findingsBasePath) || DEFAULT_FINDINGS_BASE_PATH,
    locationId: trimToNull(requestBody.locationId),
    locationCode: trimToNull(requestBody.locationCode) || trimToNull(requestBody.icaoCode),
    locationName: trimToNull(requestBody.locationName) || trimToNull(requestBody.icaoName),
    specialtyId: trimToNull(requestBody.specialtyId) || trimToNull(requestBody.domain),
    specialtyCode: trimToNull(requestBody.specialtyCode),
    specialtyName: trimToNull(requestBody.specialtyName),
    inspectionType: trimToNull(requestBody.inspectionType),
    inspectionStatus: trimToNull(requestBody.inspectionStatus) || "Reported",
    startDate: trimToNull(requestBody.startDate),
    endDate: trimToNull(requestBody.endDate)
  };
}

function extractFollowUpFileNamesRequest(requestBody) {
  var payload = requestBody;

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object" && Array.isArray(payload.followUpFiles)) {
    return payload.followUpFiles;
  }

  if (payload && typeof payload === "object" && Array.isArray(payload.followUpFileNames)) {
    return payload.followUpFileNames;
  }

  return null;
}

function resolveFollowUpSourceBasePath(requestBody) {
  if (requestBody && typeof requestBody === "object") {
    return trimToNull(requestBody.sourceBasePath) || DEFAULT_SOURCE_BASE_PATH;
  }
  return DEFAULT_SOURCE_BASE_PATH;
}

function buildNodePathOrFallback(node, fallbackPath) {
  if (node && trimToNull(node.displayPath) && trimToNull(node.name)) {
    return node.displayPath + "/" + node.name;
  }

  return fallbackPath;
}

function resolveFollowUpSpecialtyFolderHint(requestBody) {
  if (!requestBody || typeof requestBody !== "object") {
    return null;
  }

  var followUpReport = requestBody.followUpReport && typeof requestBody.followUpReport === "object"
    ? requestBody.followUpReport
    : null;

  return firstNonEmpty(
    requestBody.sourceSpecialtyFolderName,
    requestBody.specialtyFolderName,
    requestBody.specialtyName,
    requestBody.specialtyCode,
    requestBody.specialtyId,
    requestBody.domain,
    followUpReport ? followUpReport.sourceSpecialtyFolderName : null,
    followUpReport ? followUpReport.specialtyFolderName : null,
    followUpReport ? followUpReport.specialtyName : null,
    followUpReport ? followUpReport.specialtyCode : null,
    followUpReport ? followUpReport.specialtyId : null,
    followUpReport ? followUpReport.domain : null
  );
}

function resolveFollowUpSourceFolder(sourceBasePath, requestBody) {
  var baseFolder = companyhome.childByNamePath(sourceBasePath);
  if (!baseFolder || !baseFolder.exists()) {
    fail(404, "Canonical models base folder not found: " + sourceBasePath);
  }

  var specialtyFolderName = resolveFollowUpSpecialtyFolderHint(requestBody);

  specialtyFolderName = trimToNull(specialtyFolderName);
  if (specialtyFolderName === null) {
    return {
      folder: baseFolder,
      sourceFolderPath: buildNodePathOrFallback(baseFolder, sourceBasePath),
      specialtyFolderName: null
    };
  }

  var specialtyFolder = baseFolder.childByNamePath(specialtyFolderName);
  if (!specialtyFolder || !specialtyFolder.exists() || !specialtyFolder.isContainer) {
    fail(
      404,
      "Specialty source folder not found under canonical base path: " +
      sourceBasePath + "/" + specialtyFolderName +
      ". Provide a valid sourceSpecialtyFolderName/specialtyFolderName or verify specialtyName/specialtyCode/specialtyId/domain."
    );
  }

  return {
    folder: specialtyFolder,
    sourceFolderPath: buildNodePathOrFallback(specialtyFolder, sourceBasePath + "/" + specialtyFolderName),
    specialtyFolderName: specialtyFolderName
  };
}

function findCanonicalFilesByName(rootFolder, fileName) {
  if (!rootFolder || !fileName) {
    return [];
  }

  var directNode = rootFolder.childByNamePath(fileName);
  if (directNode && directNode.exists() && directNode.isDocument) {
    return [directNode];
  }

  var matches = [];
  var allDocuments = rootFolder.childFileFolders(true, false);
  var expectedName = String(fileName).toLowerCase();
  for (var index = 0; index < allDocuments.length; index++) {
    var candidate = allDocuments[index];
    if (!candidate || !candidate.isDocument) {
      continue;
    }
    if (String(candidate.name).toLowerCase() === expectedName) {
      matches.push(candidate);
    }
  }

  return matches;
}

function buildCanonicalFileNameIndex(rootFolder) {
  var names = [];
  if (!rootFolder) {
    return names;
  }

  var allDocuments = rootFolder.childFileFolders(true, false);
  for (var index = 0; index < allDocuments.length; index++) {
    var candidate = allDocuments[index];
    if (!candidate || !candidate.isDocument) {
      continue;
    }
    names.push(String(candidate.name));
  }

  return names;
}

function buildNameTokens(value) {
  var normalized = trimToNull(value);
  if (normalized === null) {
    return [];
  }

  var tokens = String(normalized).toLowerCase().split(/[^a-z0-9]+/);
  var filtered = [];
  for (var index = 0; index < tokens.length; index++) {
    if (tokens[index].length >= 2) {
      filtered.push(tokens[index]);
    }
  }
  return filtered;
}

function suggestCanonicalFileNames(expectedFileName, fileNameIndex, maxSuggestions) {
  var suggestions = [];
  var requested = trimToNull(expectedFileName);
  if (requested === null || !fileNameIndex || fileNameIndex.length === 0) {
    return suggestions;
  }

  var requestedLower = requested.toLowerCase();
  var requestedTokens = buildNameTokens(requestedLower);
  var ranked = [];

  for (var index = 0; index < fileNameIndex.length; index++) {
    var candidateName = fileNameIndex[index];
    var candidateLower = candidateName.toLowerCase();
    var score = 0;

    if (candidateLower.indexOf(requestedLower) !== -1 || requestedLower.indexOf(candidateLower) !== -1) {
      score += 5;
    }

    for (var tokenIndex = 0; tokenIndex < requestedTokens.length; tokenIndex++) {
      if (candidateLower.indexOf(requestedTokens[tokenIndex]) !== -1) {
        score += 1;
      }
    }

    if (score > 0) {
      ranked.push({ name: candidateName, score: score });
    }
  }

  ranked.sort(function(a, b) {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
  });

  var limit = maxSuggestions || 5;
  for (var rankedIndex = 0; rankedIndex < ranked.length && suggestions.length < limit; rankedIndex++) {
    suggestions.push(ranked[rankedIndex].name);
  }

  return suggestions;
}

function parseFollowUpCanonicalPayload(node) {
  try {
    var root = JSON.parse(String(node.content));
    var report = root && root.followUpReport;
    if (!report || typeof report !== "object") {
      return { error: "Missing required object: followUpReport " + node.name };
    }
    if (trimToNull(report.findingId) === null) {
      return { error: "Missing required field: followUpReport.findingId" };
    }
    return { root: root, report: report };
  } catch (error) {
    return { error: "Invalid JSON in canonical follow-up file " + node.name + ": " + error.message };
  }
}

function findFindingNodesById(findingId) {
  var query =
    "+TYPE:\"vso:finding\" " +
    "+@vso\\:findingId:\"" + escapeLuceneValue(findingId) + "\"";
  return search.luceneSearch(query) || [];
}

function findCorrectiveActionByCapId(capId) {
  var normalizedCapId = FOLLOW_UP_HELPERS.normalizeCapIdentifier(capId);
  if (normalizedCapId === null) {
    return [];
  }

  var query =
    "+TYPE:\"vso:correctiveAction\" " +
    "+(@vso\\:capId:\"" + escapeLuceneValue(normalizedCapId) + "\" " +
    "OR @cm\\:name:\"" + escapeLuceneValue(normalizedCapId) + ".json\" " +
    "OR @cm\\:name:\"" + escapeLuceneValue(normalizedCapId) + "\")";

  return search.luceneSearch(query) || [];
}

function buildFollowUpNodeName(reportPayload, sourceFileName) {
  var followUpId = trimToNull(reportPayload.followUpId);
  if (followUpId !== null) {
    return followUpId + ".json";
  }

  var normalizedSourceName = trimToNull(sourceFileName);
  if (normalizedSourceName !== null) {
    return normalizedSourceName;
  }

  return "follow-up.json";
}

function extractFileExtension(fileName) {
  var normalized = trimToNull(fileName);
  if (normalized === null) {
    return "";
  }

  var lastDot = normalized.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === normalized.length - 1) {
    return "";
  }

  return normalized.substring(lastDot);
}

function resolveFollowUpEvidenceFolderName(followUpNode, reportPayload) {
  var followUpId = firstNonEmpty(
    reportPayload ? reportPayload.followUpId : null,
    followUpNode && followUpNode.properties ? followUpNode.properties["vso:followUpId"] : null,
    followUpNode ? followUpNode.name : null
  );

  followUpId = trimToNull(followUpId);
  if (followUpId === null) {
    followUpId = "unknown";
  }

  followUpId = String(followUpId).replace(/\.json$/i, "").replace(/[\\\/]/g, "-");
  return "Evidence " + followUpId;
}

function upsertFollowUpEvidence(followUpNode, findingNode, reportPayload, sourceRootFolder, followUpSourceFolder, summary) {
  var evidenceItems = toJsArray(reportPayload.evidenceItems);
  if (evidenceItems === null) {
    fail(400, "followUpReport.evidenceItems must be an array");
  }

  var destinationFolder = findingNode.parent;
  if (!destinationFolder || !destinationFolder.exists()) {
    fail(500, "Unable to resolve destination folder for finding " + trimToNull(findingNode.properties["vso:findingId"]));
  }

  var evidenceSubfolderResult = ensureFolder(destinationFolder, resolveFollowUpEvidenceFolderName(followUpNode, reportPayload));
  var evidenceFolder = evidenceSubfolderResult.node;

  for (var evidenceIndex = 0; evidenceIndex < evidenceItems.length; evidenceIndex++) {
    var evidencePayload = evidenceItems[evidenceIndex];
    if (!evidencePayload || typeof evidencePayload !== "object") {
      fail(400, "Invalid evidence entry at followUpReport.evidenceItems[" + evidenceIndex + "]");
    }

    var evidenceId = trimToNull(evidencePayload.evidenceId);
    if (evidenceId === null) {
      fail(400, "Missing required field followUpReport.evidenceItems[" + evidenceIndex + "].evidenceId");
    }

    var evidenceSource = firstNonEmpty(evidencePayload.source, evidencePayload.evidenceSource);
    if (trimToNull(evidenceSource) === null) {
      fail(400, "Missing required field followUpReport.evidenceItems[" + evidenceIndex + "].source");
    }

    var sourceFile = findEvidenceFileByName(followUpSourceFolder, evidenceSource, false);
    if (!sourceFile) {
      sourceFile = findEvidenceFileByName(sourceRootFolder, evidenceSource, true);
    }
    if (!sourceFile) {
      fail(404, "Evidence source file not found: " + evidenceSource);
    }

    var extension = extractFileExtension(sourceFile.name);
    var targetName = evidenceId + extension;
    var evidenceNode = findDocumentByName(evidenceFolder, targetName);
    var created = false;

    if (!evidenceNode) {
      evidenceNode = findDocumentByName(destinationFolder, targetName);

      if (evidenceNode) {
        evidenceNode.move(evidenceFolder);
        evidenceNode = findDocumentByName(evidenceFolder, evidenceNode.name);
      } else {
        sourceFile.move(evidenceFolder);
        evidenceNode = findDocumentByName(evidenceFolder, sourceFile.name);
        if (!evidenceNode) {
          fail(500, "Failed to move evidence file into destination evidence folder: " + sourceFile.name);
        }
        created = true;
      }

      if (evidenceNode && evidenceNode.name !== targetName) {
        evidenceNode.name = targetName;
      }
    }

    if (!evidenceNode.isSubType("vso:evidenceItem")) {
      evidenceNode.specializeType("vso:evidenceItem");
    }

    ensureVersionable(evidenceNode);
    ensureAspect(evidenceNode, "vso:evidenceIntegrity");
    ensureAspect(evidenceNode, "vso:inspectionContext");
    ensureAspect(evidenceNode, "vso:serviceContext");

    setPropertyIfPresent(evidenceNode, "cm:title", evidenceId);
    setPropertyIfPresent(evidenceNode, "vso:contentType", "evidenceItem");
    setPropertyIfPresent(evidenceNode, "vso:evidenceId", evidenceId);
    setPropertyIfPresent(evidenceNode, "vso:evidenceType", evidencePayload.evidenceType);
    setPropertyIfPresent(evidenceNode, "vso:source", evidenceSource);
    setPropertyIfPresent(evidenceNode, "vso:inspectionId", firstNonEmpty(reportPayload.inspectionId, findingNode.properties["vso:inspectionId"]));
    setPropertyIfPresent(evidenceNode, "vso:locationId", firstNonEmpty(reportPayload.locationId, findingNode.properties["vso:locationId"]));
    setPropertyIfPresent(evidenceNode, "vso:locationCode", firstNonEmpty(reportPayload.locationCode, findingNode.properties["vso:locationCode"]));
    setPropertyIfPresent(evidenceNode, "vso:locationName", firstNonEmpty(reportPayload.locationName, findingNode.properties["vso:locationName"]));
    setPropertyIfPresent(evidenceNode, "vso:specialtyId", firstNonEmpty(reportPayload.specialtyId, findingNode.properties["vso:specialtyId"]));
    setPropertyIfPresent(evidenceNode, "vso:specialtyCode", firstNonEmpty(reportPayload.specialtyCode, findingNode.properties["vso:specialtyCode"]));
    setPropertyIfPresent(evidenceNode, "vso:specialtyName", firstNonEmpty(reportPayload.specialtyName, findingNode.properties["vso:specialtyName"]));
    setPropertyIfPresent(evidenceNode, "vso:providerId", firstNonEmpty(reportPayload.providerId, findingNode.properties["vso:providerId"]));
    setPropertyIfPresent(evidenceNode, "vso:providerName", firstNonEmpty(reportPayload.providerName, findingNode.properties["vso:providerName"]));
    setDatePropertyIfPresent(evidenceNode, "vso:collectionDate", evidencePayload.collectionDate);
    setPropertyIfPresent(evidenceNode, "vso:evidenceRole", evidencePayload.evidenceRole);
    setPropertyIfPresent(evidenceNode, "vso:hashValue", evidencePayload.hashValue);
    setDatePropertyIfPresent(evidenceNode, "vso:sealedDate", evidencePayload.sealedDate);
    if (evidencePayload.immutable !== null && evidencePayload.immutable !== undefined) {
      evidenceNode.properties["vso:immutable"] = !!evidencePayload.immutable;
    }
    evidenceNode.save();

    ensureAssociation(followUpNode, evidenceNode, "vso:relatedEvidence");
    summary[created ? "created" : "updated"]++;
    summary.evidenceImported++;
  }
}

function upsertFollowUpFromCanonicalFile(followUpFileNode, sourceRootFolder, summary) {
  var parsed = parseFollowUpCanonicalPayload(followUpFileNode);
  if (parsed.error) {
    return {
      status: "invalid",
      message: parsed.error,
      fileName: followUpFileNode.name
    };
  }

  var report = parsed.report;
  var findingId = trimToNull(report.findingId);
  var findingMatches = findFindingNodesById(findingId);
  if (findingMatches.length === 0) {
    return {
      status: "finding-not-found",
      fileName: followUpFileNode.name,
      findingId: findingId
    };
  }

  if (findingMatches.length > 1) {
    return {
      status: "ambiguous-finding",
      fileName: followUpFileNode.name,
      findingId: findingId,
      matches: findingMatches.length
    };
  }

  var findingNode = findingMatches[0];
  var followUpNodeName = buildFollowUpNodeName(report, followUpFileNode.name);
  var followUpResult = ensureChildNode(findingNode, followUpNodeName, "vso:followUpReport", "vso:hasFollowUp");
  var followUpNode = followUpResult.node;

  ensureVersionable(followUpNode);
  ensureAspect(followUpNode, "vso:inspectionContext");
  ensureAspect(followUpNode, "vso:serviceContext");

  followUpNode.content = JSON.stringify(parsed.root, null, 2);
  followUpNode.mimetype = JSON_MIMETYPE;

  setPropertyIfPresent(followUpNode, "cm:title", trimToNull(report.followUpId) || followUpNodeName);
  setPropertyIfPresent(followUpNode, "vso:contentType", "followUpReport");
  setPropertyIfPresent(followUpNode, "vso:followUpId", report.followUpId);
  setPropertyIfPresent(followUpNode, "vso:followUpType", report.followUpType);
  setDatePropertyIfPresent(followUpNode, "vso:followUpDate", report.followUpDate);
  setPropertyIfPresent(followUpNode, "vso:percentComplete", report.percentComplete);
  setDatePropertyIfPresent(followUpNode, "vso:followUpClosureDate", report.followUpClosureDate);
  setPropertyIfPresent(followUpNode, "vso:closureVerificationMethod", report.closureVerificationMethod);
  if (report.effectivenessConfirmed !== null && report.effectivenessConfirmed !== undefined) {
    followUpNode.properties["vso:effectivenessConfirmed"] = normalizeBooleanFlag(report.effectivenessConfirmed);
  }
  setPropertyIfPresent(followUpNode, "vso:followUpComment", report.followUpComment);
  setPropertyIfPresent(followUpNode, "vso:inspectionId", firstNonEmpty(report.inspectionId, findingNode.properties["vso:inspectionId"]));
  setPropertyIfPresent(followUpNode, "vso:locationId", firstNonEmpty(report.locationId, findingNode.properties["vso:locationId"]));
  setPropertyIfPresent(followUpNode, "vso:locationCode", firstNonEmpty(report.locationCode, findingNode.properties["vso:locationCode"]));
  setPropertyIfPresent(followUpNode, "vso:locationName", firstNonEmpty(report.locationName, findingNode.properties["vso:locationName"]));
  setPropertyIfPresent(followUpNode, "vso:specialtyId", firstNonEmpty(report.specialtyId, findingNode.properties["vso:specialtyId"]));
  setPropertyIfPresent(followUpNode, "vso:specialtyCode", firstNonEmpty(report.specialtyCode, findingNode.properties["vso:specialtyCode"]));
  setPropertyIfPresent(followUpNode, "vso:specialtyName", firstNonEmpty(report.specialtyName, findingNode.properties["vso:specialtyName"]));
  setPropertyIfPresent(followUpNode, "vso:providerId", firstNonEmpty(report.providerId, findingNode.properties["vso:providerId"]));
  setPropertyIfPresent(followUpNode, "vso:providerName", firstNonEmpty(report.providerName, findingNode.properties["vso:providerName"]));
  followUpNode.save();

  summary[followUpResult.created ? "created" : "updated"]++;

  var capId = trimToNull(report.capId);
  if (capId !== null) {
    var capMatches = findCorrectiveActionByCapId(capId);
    if (capMatches.length === 0) {
      return {
        status: "cap-not-found",
        fileName: followUpFileNode.name,
        followUpId: trimToNull(report.followUpId),
        findingId: findingId,
        capId: capId
      };
    }

    if (capMatches.length > 1) {
      return {
        status: "ambiguous-cap",
        fileName: followUpFileNode.name,
        followUpId: trimToNull(report.followUpId),
        findingId: findingId,
        capId: capId,
        matches: capMatches.length
      };
    }

    ensureAssociation(followUpNode, capMatches[0], "vso:relatedCorrectiveAction");
  }

  upsertFollowUpEvidence(followUpNode, findingNode, report, sourceRootFolder, followUpFileNode.parent || sourceRootFolder, summary);

  var closurePolicy = FOLLOW_UP_HELPERS.validateClosurePolicy(report.followUpType, normalizeBooleanFlag(report.effectivenessConfirmed));
  if (closurePolicy.error) {
    return {
      status: "invalid",
      message: closurePolicy.error,
      fileName: followUpFileNode.name,
      followUpId: trimToNull(report.followUpId),
      findingId: findingId
    };
  }

  if (closurePolicy.shouldClose) {
    var now = new Date();
    findingNode.properties["vso:findingStatus"] = "Closed";
    findingNode.properties["vso:findingClosureDate"] = now;
    findingNode.properties["vso:lastStatusChange"] = now;
    findingNode.save();
    summary.findingClosures++;
  }

  return {
    status: "processed",
    fileName: followUpFileNode.name,
    followUpId: trimToNull(report.followUpId),
    findingId: findingId,
    followUpNodeRef: String(followUpNode.nodeRef),
    findingStatus: trimToNull(findingNode.properties["vso:findingStatus"])
  };
}

function processFollowUpsByFileNames(followUpFileNames, requestBody) {
  if (!Array.isArray(followUpFileNames) || followUpFileNames.length === 0) {
    fail(400, "Request must include a non-empty followUpFiles array");
  }

  var sourceBasePath = resolveFollowUpSourceBasePath(requestBody);
  var resolvedSourceFolder = resolveFollowUpSourceFolder(sourceBasePath, requestBody);
  var sourceRootFolder = resolvedSourceFolder.folder;
  var sourceFolderPath = resolvedSourceFolder.sourceFolderPath;
  var fileNameIndex = buildCanonicalFileNameIndex(sourceRootFolder);

  var summary = {
    requested: followUpFileNames.length,
    processed: 0,
    findingClosures: 0,
    evidenceImported: 0,
    notFound: 0,
    ambiguous: 0,
    invalid: 0,
    created: 0,
    updated: 0
  };

  var details = [];

  for (var index = 0; index < followUpFileNames.length; index++) {
    var fileName = trimToNull(followUpFileNames[index]);
    if (fileName === null) {
      summary.invalid++;
      details.push({
        fileName: null,
        status: "invalid",
        message: "followUpFiles entries must be non-empty strings"
      });
      continue;
    }

    var fileMatches = findCanonicalFilesByName(sourceRootFolder, fileName);
    if (fileMatches.length === 0) {
      summary.notFound++;
      details.push({
        fileName: fileName,
        status: "not-found",
        sourceFolderPath: sourceFolderPath,
        suggestions: suggestCanonicalFileNames(fileName, fileNameIndex, 5)
      });
      continue;
    }

    if (fileMatches.length > 1) {
      summary.ambiguous++;
      details.push({
        fileName: fileName,
        status: "ambiguous-file",
        matches: fileMatches.length
      });
      continue;
    }

    var fileResult = upsertFollowUpFromCanonicalFile(fileMatches[0], sourceRootFolder, summary);
    if (fileResult.status === "processed") {
      summary.processed++;
    } else if (fileResult.status === "ambiguous-finding" || fileResult.status === "ambiguous-cap") {
      summary.ambiguous++;
    } else if (fileResult.status === "finding-not-found" || fileResult.status === "cap-not-found") {
      summary.notFound++;
    } else {
      summary.invalid++;
    }
    details.push(fileResult);
  }

  status.code = 200;
  model.success = true;
  model.error = null;
  model.inspection = null;
  model.summary = summary;
  model.importedSources = [];
  model.followUpProcessing = {
    sourceBasePath: sourceBasePath,
    sourceFolderPath: sourceFolderPath,
    specialtyFolderName: resolvedSourceFolder.specialtyFolderName,
    details: details
  };
}

function firstNonEmpty() {
  for (var index = 0; index < arguments.length; index++) {
    var normalized = trimToNull(arguments[index]);
    if (normalized !== null) {
      return normalized;
    }
  }
  return null;
}

function resolveContextValues(source, importRequest) {
  var src = source || {};
  var req = importRequest || {};

  var locationId = firstNonEmpty(src.locationId, req.locationId);
  var locationCode = firstNonEmpty(src.locationCode, src.icaoCode, src.airportCode, req.locationCode, req.icaoCode, locationId);
  var locationName = firstNonEmpty(src.locationName, src.icaoName, req.locationName, req.icaoName);

  var specialtyId = firstNonEmpty(src.specialtyId, req.specialtyId);
  var specialtyCode = firstNonEmpty(src.specialtyCode, req.specialtyCode);
  var specialtyName = firstNonEmpty(src.specialtyName, req.specialtyName);

  return {
    locationId: locationId,
    locationCode: locationCode,
    locationName: locationName,
    specialtyId: specialtyId,
    specialtyCode: specialtyCode,
    specialtyName: specialtyName
  };
}

function resolveInspectionIdentifier(source, importRequest) {
  var src = source || {};
  var req = importRequest || {};

  return firstNonEmpty(
    src.inspectionId,
    req.inspectionId,
    src.inspectionCode,
    req.inspectionCode
  );
}

function resolveEvidenceSource(evidencePayload) {
  if (!evidencePayload) {
    return null;
  }

  return firstNonEmpty(evidencePayload.source, evidencePayload.evidenceSource);
}

function extractYear(value) {
  var normalized = trimToNull(value);
  if (normalized === null) {
    return null;
  }

  var match = String(normalized).match(/(19|20)\d{2}/);
  if (match) {
    return match[0];
  }

  return null;
}

function resolveFindingYear(importRequest, checklistPayload) {
  var candidates = [
    importRequest.startDate,
    importRequest.endDate,
    checklistPayload.startDate,
    checklistPayload.endDate,
    checklistPayload.completionDate,
    checklistPayload.inspectionDate,
    checklistPayload.reportDate,
    checklistPayload.date
  ];

  for (var index = 0; index < candidates.length; index++) {
    var year = extractYear(candidates[index]);
    if (year !== null) {
      return year;
    }
  }

  return null;
}

function loadCanonicalDocuments(domainFolder, inspectionCode) {
  var documents = domainFolder.childFileFolders(true, false);
  var checklistDocument = null;
  var findingDocuments = [];
  var importedSources = [];

  for (var index = 0; index < documents.length; index++) {
    var documentNode = documents[index];
    if (!documentNode.isDocument || documentNode.name.toLowerCase().indexOf(".json") === -1) {
      continue;
    }

    var payload = parseJsonContent(documentNode);
    if (payload.checklist && payload.checklist.inspectionCode === inspectionCode) {
      checklistDocument = {
        node: documentNode,
        payload: payload
      };
      importedSources.push({
        name: documentNode.name,
        type: "checklist",
        path: documentNode.displayPath + "/" + documentNode.name
      });
      continue;
    }

    if (payload.finding) {
      findingDocuments.push({
        node: documentNode,
        payload: payload
      });
    }
  }

  if (checklistDocument === null) {
    fail(404, "Checklist canonical model not found for inspectionCode: " + inspectionCode);
  }

  return {
    checklistDocument: checklistDocument,
    findingDocuments: findingDocuments,
    importedSources: importedSources
  };
}

function filterFindingsByChecklistItems(findingDocuments, itemIdIndex) {
  var matchedFindings = [];

  for (var index = 0; index < findingDocuments.length; index++) {
    var findingDocument = findingDocuments[index];
    var findingPayload = findingDocument.payload.finding;
    var findingItemCode = resolveItemCode(findingPayload || {});
    if (findingPayload && findingItemCode && itemIdIndex[findingItemCode]) {
      matchedFindings.push(findingDocument);
    }
  }

  return matchedFindings;
}

function upsertInspectionFolder(destinationBaseFolder, importRequest, checklistData, summary) {
  var contextValues = resolveContextValues(checklistData, importRequest);
  var inspectionIdentifier = resolveInspectionIdentifier(checklistData, importRequest);
  var inspectionFolderName = importRequest.inspectionCode || inspectionIdentifier;
  var inspectionFolderResult = ensureFolder(destinationBaseFolder, inspectionFolderName, "vso:inspection");
  var inspectionFolder = inspectionFolderResult.node;

  ensureAspect(inspectionFolder, "vso:inspectionContext");
  ensureAspect(inspectionFolder, "vso:serviceContext");

  setPropertyIfPresent(inspectionFolder, "cm:title", inspectionFolderName);
  setPropertyIfPresent(inspectionFolder, "vso:inspectionId", inspectionIdentifier);
  setPropertyIfPresent(inspectionFolder, "vso:inspectionType", importRequest.inspectionType);
  setDatePropertyIfPresent(inspectionFolder, "vso:startDate", importRequest.startDate);
  setDatePropertyIfPresent(inspectionFolder, "vso:endDate", importRequest.endDate);
  setPropertyIfPresent(inspectionFolder, "vso:inspectionStatus", importRequest.inspectionStatus);
  setPropertyIfPresent(inspectionFolder, "vso:locationId", contextValues.locationId);
  setPropertyIfPresent(inspectionFolder, "vso:locationCode", contextValues.locationCode);
  setPropertyIfPresent(inspectionFolder, "vso:locationName", contextValues.locationName);
  setPropertyIfPresent(inspectionFolder, "vso:specialtyId", contextValues.specialtyId);
  setPropertyIfPresent(inspectionFolder, "vso:specialtyCode", contextValues.specialtyCode);
  setPropertyIfPresent(inspectionFolder, "vso:specialtyName", contextValues.specialtyName);
  setPropertyIfPresent(inspectionFolder, "vso:providerId", checklistData.providerId);
  setPropertyIfPresent(inspectionFolder, "vso:providerName", checklistData.providerName);
  inspectionFolder.save();

  summary[inspectionFolderResult.created ? "created" : "updated"]++;

  return inspectionFolder;
}

function upsertDomainFolder(inspectionFolder, checklistPayload, summary) {
  var contextValues = resolveContextValues(checklistPayload, null);
  var inspectionIdentifier = resolveInspectionIdentifier(checklistPayload, null);
  var folderName = trimToNull(contextValues.specialtyName) || trimToNull(contextValues.specialtyCode) || trimToNull(contextValues.specialtyId) || "GENERAL";
  var domainFolderResult = ensureFolder(inspectionFolder, folderName, null);
  var domainFolder = domainFolderResult.node;

  ensureAspect(domainFolder, "vso:inspectionContext");
  ensureAspect(domainFolder, "vso:serviceContext");

  setPropertyIfPresent(domainFolder, "cm:title", folderName);
  setPropertyIfPresent(domainFolder, "vso:inspectionId", inspectionIdentifier);
  setPropertyIfPresent(domainFolder, "vso:locationId", contextValues.locationId);
  setPropertyIfPresent(domainFolder, "vso:locationCode", contextValues.locationCode);
  setPropertyIfPresent(domainFolder, "vso:locationName", contextValues.locationName);
  setPropertyIfPresent(domainFolder, "vso:specialtyId", contextValues.specialtyId);
  setPropertyIfPresent(domainFolder, "vso:specialtyCode", contextValues.specialtyCode);
  setPropertyIfPresent(domainFolder, "vso:specialtyName", contextValues.specialtyName);
  setPropertyIfPresent(domainFolder, "vso:providerId", checklistPayload.providerId);
  setPropertyIfPresent(domainFolder, "vso:providerName", checklistPayload.providerName);
  domainFolder.save();

  summary[domainFolderResult.created ? "created" : "updated"]++;

  return domainFolder;
}

function upsertChecklist(domainFolder, checklistPayload, summary) {
  var checklistName = checklistPayload.checklistId + ".json";
  var checklistResult = ensureChildNode(domainFolder, checklistName, "vso:inspectionChecklist", "cm:contains");
  var checklistNode = checklistResult.node;

  ensureVersionable(checklistNode);
  ensureAspect(checklistNode, "vso:inspectionContext");
  ensureAspect(checklistNode, "vso:serviceContext");

  checklistNode.content = buildJsonContent(checklistPayload);
  checklistNode.mimetype = JSON_MIMETYPE;

  var contextValues = resolveContextValues(checklistPayload, null);
  var inspectionIdentifier = resolveInspectionIdentifier(checklistPayload, null);

  setPropertyIfPresent(checklistNode, "cm:title", checklistPayload.checklistId);
  setPropertyIfPresent(checklistNode, "vso:contentType", "inspectionChecklist");
  setPropertyIfPresent(checklistNode, "vso:checklistId", checklistPayload.checklistId);
  setPropertyIfPresent(checklistNode, "vso:scope", checklistPayload.scope);
  setDatePropertyIfPresent(checklistNode, "vso:completionDate", checklistPayload.completionDate);
  setPropertyIfPresent(checklistNode, "vso:inspectionId", inspectionIdentifier);
  setPropertyIfPresent(checklistNode, "vso:locationId", contextValues.locationId);
  setPropertyIfPresent(checklistNode, "vso:locationCode", contextValues.locationCode);
  setPropertyIfPresent(checklistNode, "vso:locationName", contextValues.locationName);
  setPropertyIfPresent(checklistNode, "vso:specialtyId", contextValues.specialtyId);
  setPropertyIfPresent(checklistNode, "vso:specialtyCode", contextValues.specialtyCode);
  setPropertyIfPresent(checklistNode, "vso:specialtyName", contextValues.specialtyName);
  setPropertyIfPresent(checklistNode, "vso:providerId", checklistPayload.providerId);
  setPropertyIfPresent(checklistNode, "vso:providerName", checklistPayload.providerName);
  checklistNode.save();

  summary[checklistResult.created ? "created" : "updated"]++;

  return checklistNode;
}

function upsertEvidenceFolder(domainFolder, checklistPayload, summary) {
  var evidenceFolderResult = ensureFolder(domainFolder, "Evidence", null);
  var evidenceFolder = evidenceFolderResult.node;

  ensureAspect(evidenceFolder, "vso:inspectionContext");
  ensureAspect(evidenceFolder, "vso:serviceContext");

  var contextValues = resolveContextValues(checklistPayload, null);
  var inspectionIdentifier = resolveInspectionIdentifier(checklistPayload, null);

  setPropertyIfPresent(evidenceFolder, "cm:title", "Evidence");
  setPropertyIfPresent(evidenceFolder, "vso:inspectionId", inspectionIdentifier);
  setPropertyIfPresent(evidenceFolder, "vso:locationId", contextValues.locationId);
  setPropertyIfPresent(evidenceFolder, "vso:locationCode", contextValues.locationCode);
  setPropertyIfPresent(evidenceFolder, "vso:locationName", contextValues.locationName);
  setPropertyIfPresent(evidenceFolder, "vso:specialtyId", contextValues.specialtyId);
  setPropertyIfPresent(evidenceFolder, "vso:specialtyCode", contextValues.specialtyCode);
  setPropertyIfPresent(evidenceFolder, "vso:specialtyName", contextValues.specialtyName);
  setPropertyIfPresent(evidenceFolder, "vso:providerId", checklistPayload.providerId);
  setPropertyIfPresent(evidenceFolder, "vso:providerName", checklistPayload.providerName);
  evidenceFolder.save();

  summary[evidenceFolderResult.created ? "created" : "updated"]++;

  return evidenceFolder;
}

function resolveItemLabel(itemPayload) {
  return trimToNull(itemPayload.itemCode) || trimToNull(itemPayload.itemId) || "unknown-item";
}

function resolveItemCode(itemPayload) {
  return trimToNull(itemPayload.checklistItemCode) || trimToNull(itemPayload.itemCode) || trimToNull(itemPayload.itemId);
}

function resolveChecklistItemInstanceId(itemPayload) {
  return trimToNull(itemPayload.checklistItemId) || trimToNull(itemPayload.itemInstanceId) || trimToNull(itemPayload.itemId) || resolveItemCode(itemPayload);
}

function resolveNominalRisk(itemPayload) {
  if (!itemPayload) {
    return null;
  }

  return firstNonEmpty(
    itemPayload.nominalRisk,
    itemPayload.nominalRiskLevel,
    itemPayload.riskLevel
  );
}

function getCollectionLength(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value.length === "number") {
    return value.length;
  }

  if (typeof value.size === "function") {
    return value.size();
  }

  return 0;
}

function getCollectionItem(value, index) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value.get === "function") {
    return value.get(index);
  }

  return value[index];
}

function toJsArray(value) {
  if (value === null || value === undefined) {
    return [];
  }

  var isListLike = typeof value.length === "number" || typeof value.size === "function";
  if (!isListLike) {
    return null;
  }

  var normalized = [];
  var total = getCollectionLength(value);
  for (var index = 0; index < total; index++) {
    normalized.push(getCollectionItem(value, index));
  }

  return normalized;
}

function normalizeEvidencePayloads(evidencePayload, itemPayload) {
  if (evidencePayload === null || evidencePayload === undefined) {
    return [];
  }

  var payloads = null;
  var normalizedCollection = toJsArray(evidencePayload);
  if (normalizedCollection !== null) {
    payloads = normalizedCollection;
  } else if (typeof evidencePayload === "object") {
    payloads = [evidencePayload];
  } else {
    fail(400, "Invalid evidence format for item " + resolveItemLabel(itemPayload) + ": expected an object or array");
  }

  for (var evidenceIndex = 0; evidenceIndex < payloads.length; evidenceIndex++) {
    var evidenceItem = payloads[evidenceIndex];
    if (!evidenceItem || typeof evidenceItem !== "object") {
      fail(400, "Invalid evidence entry at index " + evidenceIndex + " for item " + resolveItemLabel(itemPayload) + ": expected an object");
    }

    if (trimToNull(evidenceItem.evidenceId) === null) {
      fail(400, "Missing required field evidenceId for evidence at index " + evidenceIndex + " in item " + resolveItemLabel(itemPayload));
    }
  }

  return payloads;
}

function padLeftNumber(number, size) {
  var result = String(number);
  while (result.length < size) {
    result = "0" + result;
  }
  return result;
}

function buildSequentialEvidenceName(sequenceNumber, rawName) {
  var suffix = "";
  if (rawName) {
    var lastDot = rawName.lastIndexOf(".");
    if (lastDot > 0) {
      suffix = rawName.substring(lastDot);
    }
  }

  return "EV-" + padLeftNumber(sequenceNumber, 3) + suffix;
}

function allocateSequentialEvidenceName(inspectionFolder, rawName, evidenceImportContext) {
  if (!evidenceImportContext) {
    evidenceImportContext = {};
  }

  if (typeof evidenceImportContext.nextEvidenceNumber !== "number") {
    evidenceImportContext.nextEvidenceNumber = 1;
  }

  var proposedName;
  do {
    proposedName = buildSequentialEvidenceName(evidenceImportContext.nextEvidenceNumber, rawName);
    evidenceImportContext.nextEvidenceNumber++;
  } while (findDocumentByName(inspectionFolder, proposedName) !== null);

  return proposedName;
}

function createEvidenceImportContext(inspectionFolder) {
  var context = {
    importedBySource: {},
    nextEvidenceNumber: 1
  };

  if (!inspectionFolder) {
    return context;
  }

  var children = inspectionFolder.childFileFolders(false, false);
  var maxSequence = 0;

  for (var index = 0; index < children.length; index++) {
    var child = children[index];
    if (!child || !child.isDocument) {
      continue;
    }

    var sourceValue = trimToNull(child.properties["vso:source"]);
    if (sourceValue !== null && !context.importedBySource[sourceValue]) {
      context.importedBySource[sourceValue] = child;
    }

    var match = String(child.name).match(/^EV-(\d+)(\..+)?$/);
    if (match) {
      var parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > maxSequence) {
        maxSequence = parsed;
      }
    }
  }

  context.nextEvidenceNumber = maxSequence + 1;
  return context;
}

function findEvidenceFileByName(folderNode, fileName, recursive) {
  if (!folderNode || !fileName) {
    return null;
  }

  var directNode = folderNode.childByNamePath(fileName);
  if (directNode && directNode.exists() && directNode.isDocument) {
    return directNode;
  }

  var childFiles = folderNode.childFileFolders(!!recursive, false);
  var targetName = String(fileName).toLowerCase();
  for (var fileIndex = 0; fileIndex < childFiles.length; fileIndex++) {
    var candidate = childFiles[fileIndex];
    if (candidate && candidate.isDocument && String(candidate.name).toLowerCase() === targetName) {
      return candidate;
    }
  }

  return null;
}

function upsertEvidence(evidenceFolder, checklistData, itemPayload, sourceEvidenceFolder, sourceDomainFolder, summary, evidenceImportContext) {
  var contextValues = resolveContextValues(checklistData, null);
  var inspectionIdentifier = resolveInspectionIdentifier(checklistData, null);
  var evidencePayloads = normalizeEvidencePayloads(
    itemPayload.evidenceItems !== undefined ? itemPayload.evidenceItems : itemPayload.evidence,
    itemPayload
  );
  var evidenceNodes = [];

  for (var evidenceIndex = 0; evidenceIndex < evidencePayloads.length; evidenceIndex++) {
    var evidencePayload = evidencePayloads[evidenceIndex];
    var itemCode = itemPayload.itemCode || itemPayload.itemId;
    var sourceKey = resolveEvidenceSource(evidencePayload);
    var importedBySource = evidenceImportContext && evidenceImportContext.importedBySource ? evidenceImportContext.importedBySource : null;
    var previouslyImportedNode = sourceKey && importedBySource ? importedBySource[sourceKey] : null;

    // Same source file referenced by multiple items: reuse the first moved node.
    if (previouslyImportedNode && previouslyImportedNode.exists()) {
      logger.log("[import-canonical-models] evidence mode=binary-reference itemCode=" + itemCode + " evidenceId=" + evidencePayload.evidenceId + " source=" + sourceKey + " file=" + previouslyImportedNode.name + " op=associated-only");
      evidenceNodes.push(previouslyImportedNode);
      continue;
    }

    var sourceFile = null;
    var evidenceName = evidencePayload.evidenceId;
    var evidenceMode = "binary-move";

    if (sourceKey !== null) {
      sourceFile = findEvidenceFileByName(sourceEvidenceFolder, sourceKey, false);
      if (!sourceFile && sourceDomainFolder) {
        sourceFile = findEvidenceFileByName(sourceDomainFolder, sourceKey, true);
      }
    }

    if (!sourceFile && sourceEvidenceFolder) {
      var childFiles = sourceEvidenceFolder.childFileFolders(false, false);
      for (var idx = 0; idx < childFiles.length; idx++) {
        var candidate = childFiles[idx];
        if (candidate.isDocument && candidate.name.indexOf(evidencePayload.evidenceId) === 0) {
          sourceFile = candidate;
          break;
        }
      }
    }

    if (!sourceFile && sourceDomainFolder && sourceDomainFolder !== sourceEvidenceFolder) {
      var domainFiles = sourceDomainFolder.childFileFolders(true, false);
      for (var domainIdx = 0; domainIdx < domainFiles.length; domainIdx++) {
        var domainCandidate = domainFiles[domainIdx];
        if (domainCandidate.isDocument && domainCandidate.name.indexOf(evidencePayload.evidenceId) === 0) {
          sourceFile = domainCandidate;
          break;
        }
      }
    }

    var evidenceNode = null;
    var evidenceCreated = false;

    if (sourceFile) {
      evidenceName = allocateSequentialEvidenceName(evidenceFolder, sourceFile.name, evidenceImportContext);
      sourceFile.move(evidenceFolder);
      evidenceNode = findDocumentByName(evidenceFolder, sourceFile.name);
      if (evidenceNode === null) {
        fail(500, "Failed to move evidence file into destination folder: " + sourceFile.name);
      }

      if (evidenceNode.name !== evidenceName) {
        evidenceNode.name = evidenceName;
      }

      evidenceCreated = true;
      evidenceMode = "binary-move";

      if (!evidenceNode.isSubType("vso:evidenceItem")) {
        evidenceNode.specializeType("vso:evidenceItem");
      }
    } else {
      logger.warn("[import-canonical-models] evidence mode=skipped itemCode=" + itemCode + " evidenceId=" + evidencePayload.evidenceId + " source=" + (sourceKey || "-") + " reason=source-file-not-found");
      continue;
    }

    ensureVersionable(evidenceNode);
    ensureAspect(evidenceNode, "vso:evidenceIntegrity");
    ensureAspect(evidenceNode, "vso:inspectionContext");
    ensureAspect(evidenceNode, "vso:serviceContext");

    setPropertyIfPresent(evidenceNode, "cm:title", evidencePayload.evidenceId);
    setPropertyIfPresent(evidenceNode, "vso:contentType", "evidenceItem");
    setPropertyIfPresent(evidenceNode, "vso:evidenceId", evidencePayload.evidenceId);
    setPropertyIfPresent(evidenceNode, "vso:evidenceType", evidencePayload.evidenceType);
    setPropertyIfPresent(evidenceNode, "vso:source", sourceKey);
    setPropertyIfPresent(evidenceNode, "vso:inspectionId", inspectionIdentifier);
    setPropertyIfPresent(evidenceNode, "vso:locationId", contextValues.locationId);
    setPropertyIfPresent(evidenceNode, "vso:locationCode", contextValues.locationCode);
    setPropertyIfPresent(evidenceNode, "vso:locationName", contextValues.locationName);
    setPropertyIfPresent(evidenceNode, "vso:specialtyId", contextValues.specialtyId);
    setPropertyIfPresent(evidenceNode, "vso:specialtyCode", contextValues.specialtyCode);
    setPropertyIfPresent(evidenceNode, "vso:specialtyName", contextValues.specialtyName);
    setPropertyIfPresent(evidenceNode, "vso:providerId", checklistData.providerId);
    setPropertyIfPresent(evidenceNode, "vso:providerName", checklistData.providerName);
    setDatePropertyIfPresent(evidenceNode, "vso:collectionDate", evidencePayload.collectionDate);
    setPropertyIfPresent(evidenceNode, "vso:evidenceRole", evidencePayload.evidenceRole);
    setPropertyIfPresent(evidenceNode, "vso:hashValue", evidencePayload.hashValue);
    setDatePropertyIfPresent(evidenceNode, "vso:sealedDate", evidencePayload.sealedDate);
    if (evidencePayload.immutable !== null && evidencePayload.immutable !== undefined) {
      evidenceNode.properties["vso:immutable"] = !!evidencePayload.immutable;
    } else {
      evidenceNode.properties["vso:immutable"] = false;
    }
    evidenceNode.save();

    if (sourceKey && importedBySource && sourceFile) {
      importedBySource[sourceKey] = evidenceNode;
    }

    logger.log("[import-canonical-models] evidence mode=" + evidenceMode + " itemCode=" + itemCode + " evidenceId=" + evidencePayload.evidenceId + " file=" + evidenceName + " op=" + (evidenceCreated ? "created" : "updated"));

    summary[evidenceCreated ? "created" : "updated"]++;
    evidenceNodes.push(evidenceNode);
  }

  return evidenceNodes;
}

function upsertChecklistItem(checklistNode, checklistData, itemPayload, summary) {
  var contextValues = resolveContextValues(checklistData, null);
  var inspectionIdentifier = resolveInspectionIdentifier(checklistData, null);
  var itemCode = resolveItemCode(itemPayload);
  var checklistItemInstanceId = resolveChecklistItemInstanceId(itemPayload);
  var itemName = (itemCode || checklistItemInstanceId || "unknown-item") + ".json";
  var itemResult = ensureChildNode(checklistNode, itemName, "vso:checklistItem", "vso:hasChecklistItem");
  var itemNode = itemResult.node;

  ensureVersionable(itemNode);
  ensureAspect(itemNode, "vso:regulatoryTraceability");
  ensureAspect(itemNode, "vso:inspectionContext");
  ensureAspect(itemNode, "vso:serviceContext");

  itemNode.content = buildJsonContent(itemPayload);
  itemNode.mimetype = JSON_MIMETYPE;

  setPropertyIfPresent(itemNode, "cm:title", itemCode || checklistItemInstanceId);
  setPropertyIfPresent(itemNode, "vso:contentType", "checklistItem");
  setPropertyIfPresent(itemNode, "vso:itemId", checklistItemInstanceId);
  setPropertyIfPresent(itemNode, "vso:itemCode", itemCode);
  setPropertyIfPresent(itemNode, "vso:requirementText", firstNonEmpty(itemPayload.requirementText, itemPayload.requirement));
  setPropertyIfPresent(itemNode, "vso:itemVerificationMethod", firstNonEmpty(itemPayload.itemVerificationMethod, itemPayload.verificationMethod));
  setPropertyIfPresent(itemNode, "vso:complianceStatus", normalizeComplianceStatus(firstNonEmpty(itemPayload.complianceStatus, itemPayload.compliance)));
  setPropertyIfPresent(itemNode, "vso:inspectorComment", firstNonEmpty(itemPayload.inspectorComment, itemPayload.comment));
  setPropertyIfPresent(itemNode, "vso:nominalRisk", resolveNominalRisk(itemPayload));
  if (itemPayload.hasOpenPriorFinding !== null && itemPayload.hasOpenPriorFinding !== undefined) {
    itemNode.properties["vso:hasOpenPriorFinding"] = !!itemPayload.hasOpenPriorFinding;
  }
  setPropertyIfPresent(itemNode, "vso:inspectionId", inspectionIdentifier);
  setPropertyIfPresent(itemNode, "vso:locationId", contextValues.locationId);
  setPropertyIfPresent(itemNode, "vso:locationCode", contextValues.locationCode);
  setPropertyIfPresent(itemNode, "vso:locationName", contextValues.locationName);
  setPropertyIfPresent(itemNode, "vso:specialtyId", contextValues.specialtyId);
  setPropertyIfPresent(itemNode, "vso:specialtyCode", contextValues.specialtyCode);
  setPropertyIfPresent(itemNode, "vso:specialtyName", contextValues.specialtyName);
  setPropertyIfPresent(itemNode, "vso:providerId", checklistData.providerId);
  setPropertyIfPresent(itemNode, "vso:providerName", checklistData.providerName);

  if (itemPayload.reference) {
    setPropertyIfPresent(itemNode, "vso:icaoReference", itemPayload.reference.icaoReference);
    setPropertyIfPresent(itemNode, "vso:nationalRegulation", itemPayload.reference.nationalRegulation);
  }

  itemNode.save();

  summary[itemResult.created ? "created" : "updated"]++;

  return itemNode;
}

function upsertFinding(inspectionFolder, checklistData, findingPayload, findingItemCode, relatedItemPayload, summary) {
  var findingName = findingPayload.findingId + ".json";
  var findingResult = ensureChildNode(inspectionFolder, findingName, "vso:finding", "cm:contains");
  var findingNode = findingResult.node;

  ensureVersionable(findingNode);
  ensureAspect(findingNode, "vso:regulatoryTraceability");
  ensureAspect(findingNode, "vso:inspectionContext");
  ensureAspect(findingNode, "vso:serviceContext");

  findingNode.content = buildJsonContent(findingPayload);
  findingNode.mimetype = JSON_MIMETYPE;

  var findingContextValues = resolveContextValues(findingPayload, null);
  var checklistContextValues = resolveContextValues(checklistData, null);
  var inspectionIdentifier = resolveInspectionIdentifier(checklistData, null);

  setPropertyIfPresent(findingNode, "cm:title", findingPayload.findingId);
  setPropertyIfPresent(findingNode, "vso:contentType", "finding");
  setPropertyIfPresent(findingNode, "vso:findingId", findingPayload.findingId);
  setPropertyIfPresent(findingNode, "vso:findingLevel", normalizeFindingLevel(findingPayload.findingLevel));
  setPropertyIfPresent(findingNode, "vso:riskClassification", findingPayload.riskClassification || findingPayload.riskLevel);
  setPropertyIfPresent(findingNode, "vso:requirementBreached", findingPayload.requirementBreached);
  setPropertyIfPresent(findingNode, "vso:checklistItemCode", findingItemCode);
  setPropertyIfPresent(findingNode, "vso:description", findingPayload.description);
  setPropertyIfPresent(findingNode, "vso:findingStatus", findingPayload.findingStatus);
  setDatePropertyIfPresent(
    findingNode,
    "vso:dateIssued",
    firstNonEmpty(findingPayload.dateIssued, findingPayload.openedDate, findingPayload.dateOpened)
  );
  setDatePropertyIfPresent(findingNode, "vso:submissionDeadline", findingPayload.submissionDeadline);
  setDatePropertyIfPresent(findingNode, "vso:findingClosureDate", findingPayload.findingClosureDate);
  setDatePropertyIfPresent(findingNode, "vso:lastStatusChange", findingPayload.lastStatusChange);
  setDatePropertyIfPresent(findingNode, "vso:resolutionDeadline", findingPayload.resolutionDeadline);
  setPropertyIfPresent(findingNode, "vso:inspectionId", inspectionIdentifier);
  setPropertyIfPresent(findingNode, "vso:locationId", findingContextValues.locationId || checklistContextValues.locationId);
  setPropertyIfPresent(findingNode, "vso:locationCode", findingContextValues.locationCode || checklistContextValues.locationCode);
  setPropertyIfPresent(findingNode, "vso:locationName", findingContextValues.locationName || checklistContextValues.locationName);
  setPropertyIfPresent(findingNode, "vso:specialtyId", findingContextValues.specialtyId || checklistContextValues.specialtyId);
  setPropertyIfPresent(findingNode, "vso:specialtyCode", findingContextValues.specialtyCode || checklistContextValues.specialtyCode);
  setPropertyIfPresent(findingNode, "vso:specialtyName", findingContextValues.specialtyName || checklistContextValues.specialtyName);
  setPropertyIfPresent(findingNode, "vso:providerId", findingPayload.providerId || checklistData.providerId);
  setPropertyIfPresent(findingNode, "vso:providerName", checklistData.providerName);

  setPropertyIfPresent(
    findingNode,
    "vso:icaoReference",
    firstNonEmpty(findingPayload.icaoReference, relatedItemPayload && relatedItemPayload.reference ? relatedItemPayload.reference.icaoReference : null)
  );
  setPropertyIfPresent(
    findingNode,
    "vso:nationalRegulation",
    firstNonEmpty(findingPayload.nationalRegulation, relatedItemPayload && relatedItemPayload.reference ? relatedItemPayload.reference.nationalRegulation : null)
  );

  findingNode.save();

  summary[findingResult.created ? "created" : "updated"]++;

  return findingNode;
}

function upsertFindingsYearFolder(findingsBaseFolder, year, checklistPayload, summary) {
  var yearFolderResult = ensureFolder(findingsBaseFolder, year, null);
  var yearFolder = yearFolderResult.node;

  ensureAspect(yearFolder, "vso:inspectionContext");
  ensureAspect(yearFolder, "vso:serviceContext");

  var contextValues = resolveContextValues(checklistPayload, null);
  var inspectionIdentifier = resolveInspectionIdentifier(checklistPayload, null);

  setPropertyIfPresent(yearFolder, "cm:title", year);
  setPropertyIfPresent(yearFolder, "vso:inspectionId", inspectionIdentifier);
  setPropertyIfPresent(yearFolder, "vso:locationId", contextValues.locationId);
  setPropertyIfPresent(yearFolder, "vso:locationCode", contextValues.locationCode);
  setPropertyIfPresent(yearFolder, "vso:locationName", contextValues.locationName);
  setPropertyIfPresent(yearFolder, "vso:specialtyId", contextValues.specialtyId);
  setPropertyIfPresent(yearFolder, "vso:specialtyCode", contextValues.specialtyCode);
  setPropertyIfPresent(yearFolder, "vso:specialtyName", contextValues.specialtyName);
  setPropertyIfPresent(yearFolder, "vso:providerId", checklistPayload.providerId);
  setPropertyIfPresent(yearFolder, "vso:providerName", checklistPayload.providerName);
  yearFolder.save();

  summary[yearFolderResult.created ? "created" : "updated"]++;

  return yearFolder;
}

try {
  model.success = false;
  model.error = null;
  model.inspection = null;
  model.summary = null;
  model.importedSources = [];

  var requestBody = requestbody.content;
  if (!requestBody || trimToNull(requestBody) === null) {
    fail(400, "Request body is empty");
  }

  var parsedBody;
  try {
    parsedBody = JSON.parse(String(requestBody));
  } catch (error) {
    fail(400, "Invalid JSON request body: " + error.message);
  }

  var followUpFilesRequest = extractFollowUpFileNamesRequest(parsedBody);
  if (followUpFilesRequest !== null) {
    processFollowUpsByFileNames(followUpFilesRequest, parsedBody);
  } else {
    var importRequest = validateImportRequest(parsedBody);

    var sourceBaseFolder = companyhome.childByNamePath(importRequest.sourceBasePath);
    if (!sourceBaseFolder || !sourceBaseFolder.exists()) {
      fail(404, "Canonical models base folder not found: " + importRequest.sourceBasePath);
    }

    var sourceSpecialtyFolderName = firstNonEmpty(importRequest.specialtyName, importRequest.specialtyCode, importRequest.specialtyId);
    if (sourceSpecialtyFolderName === null) {
      fail(400, "Missing required field: one of specialtyId, specialtyCode, or specialtyName must be provided");
    }
    var sourceDomainFolder = sourceBaseFolder.childByNamePath(sourceSpecialtyFolderName);
    if (!sourceDomainFolder || !sourceDomainFolder.exists()) {
      fail(404, "Canonical models specialty folder not found: " + sourceSpecialtyFolderName);
    }

    var destinationBaseFolder = companyhome.childByNamePath(importRequest.destinationBasePath);
    if (!destinationBaseFolder || !destinationBaseFolder.exists()) {
      fail(404, "Destination base folder not found: " + importRequest.destinationBasePath);
    }

    var findingsBaseFolder = companyhome.childByNamePath(importRequest.findingsBasePath);
    if (!findingsBaseFolder || !findingsBaseFolder.exists()) {
      fail(404, "Findings base folder not found: " + importRequest.findingsBasePath);
    }

    var canonicalDocuments = loadCanonicalDocuments(sourceDomainFolder, importRequest.inspectionCode);
    var sourceEvidenceFolder = canonicalDocuments.checklistDocument.node.parent || sourceDomainFolder;
    var checklistPayload = canonicalDocuments.checklistDocument.payload.checklist;
    var normalizedChecklistContext = resolveContextValues(checklistPayload, importRequest);
    if (normalizedChecklistContext.locationId !== null) {
      checklistPayload.locationId = normalizedChecklistContext.locationId;
    }
    if (normalizedChecklistContext.locationCode !== null) {
      checklistPayload.locationCode = normalizedChecklistContext.locationCode;
    }
    if (normalizedChecklistContext.locationName !== null) {
      checklistPayload.locationName = normalizedChecklistContext.locationName;
    }
    if (normalizedChecklistContext.specialtyId !== null) {
      checklistPayload.specialtyId = normalizedChecklistContext.specialtyId;
    }
    if (normalizedChecklistContext.specialtyCode !== null) {
      checklistPayload.specialtyCode = normalizedChecklistContext.specialtyCode;
    }
    if (normalizedChecklistContext.specialtyName !== null) {
      checklistPayload.specialtyName = normalizedChecklistContext.specialtyName;
    }
    var normalizedIdentityContext = normalizeChecklistIdentity(checklistPayload, importRequest);
    var checklistItems = toJsArray(canonicalDocuments.checklistDocument.payload.items);
    if (checklistItems === null) {
      fail(400, "Checklist canonical model field items must be an array");
    }

    if (checklistItems.length === 0) {
      fail(400, "Checklist canonical model does not include items for inspectionCode: " + importRequest.inspectionCode);
    }

    var itemIdIndex = {};
    var itemPayloadById = {};
    for (var itemIndex = 0; itemIndex < checklistItems.length; itemIndex++) {
      var checklistItem = checklistItems[itemIndex];
      var checklistItemCode = resolveItemCode(checklistItem);
      var checklistItemId = trimToNull(checklistItem.itemId);
      if (checklistItemCode) {
        itemIdIndex[checklistItemCode] = true;
        itemPayloadById[checklistItemCode] = checklistItem;
      }
      if (checklistItemId) {
        itemIdIndex[checklistItemId] = true;
        itemPayloadById[checklistItemId] = checklistItem;
      }
    }

    var matchedFindings = filterFindingsByChecklistItems(canonicalDocuments.findingDocuments, itemIdIndex);
    for (var findingIndex = 0; findingIndex < matchedFindings.length; findingIndex++) {
      canonicalDocuments.importedSources.push({
        name: matchedFindings[findingIndex].node.name,
        type: "finding",
        path: matchedFindings[findingIndex].node.displayPath + "/" + matchedFindings[findingIndex].node.name
      });
    }

    var summary = {
      created: 0,
      updated: 0,
      sourceDocuments: canonicalDocuments.importedSources.length,
      findingsImported: matchedFindings.length
    };

    var findingsYear = resolveFindingYear(importRequest, checklistPayload);
    if (findingsYear === null) {
      fail(400, "Unable to determine findings year from inspection data for inspectionCode: " + importRequest.inspectionCode);
    }

    var inspectionFolder = upsertInspectionFolder(destinationBaseFolder, importRequest, checklistPayload, summary);
    var destinationDomainFolder = upsertDomainFolder(inspectionFolder, checklistPayload, summary);
    var destinationFindingsYearFolder = upsertFindingsYearFolder(findingsBaseFolder, findingsYear, checklistPayload, summary);
    var checklistNode = upsertChecklist(destinationDomainFolder, checklistPayload, summary);
    var destinationEvidenceFolder = upsertEvidenceFolder(destinationDomainFolder, checklistPayload, summary);
    var itemNodesById = {};
    var evidenceImportContext = createEvidenceImportContext(destinationEvidenceFolder);

    logger.log("[import-canonical-models] Starting import for inspectionCode=" + importRequest.inspectionCode + " itemCount=" + checklistItems.length);
    for (itemIndex = 0; itemIndex < checklistItems.length; itemIndex++) {
      var checklistItemPayload = checklistItems[itemIndex];
      var itemNode = upsertChecklistItem(checklistNode, checklistPayload, checklistItemPayload, summary);
      var itemCode = resolveItemCode(checklistItemPayload);
      if (itemCode) {
        itemNodesById[itemCode] = itemNode;
      }

      var evidenceNodes = upsertEvidence(destinationEvidenceFolder, checklistPayload, checklistItemPayload, sourceEvidenceFolder, sourceDomainFolder, summary, evidenceImportContext);
      for (var evidenceNodeIndex = 0; evidenceNodeIndex < evidenceNodes.length; evidenceNodeIndex++) {
        itemNode.save();
        ensureAssociation(itemNode, evidenceNodes[evidenceNodeIndex], "vso:relatedEvidence");
      }
    }

    for (findingIndex = 0; findingIndex < matchedFindings.length; findingIndex++) {
      var findingPayload = matchedFindings[findingIndex].payload.finding;
      normalizeFindingIdentity(findingPayload, normalizedIdentityContext, findingIndex + 1);
      var findingItemCode = resolveItemCode(findingPayload || {});
      var relatedItemPayload = itemPayloadById[findingItemCode];
      var findingNode = upsertFinding(destinationFindingsYearFolder, checklistPayload, findingPayload, findingItemCode, relatedItemPayload, summary);
      var relatedItemNode = itemNodesById[findingItemCode];

      if (relatedItemNode) {
        relatedItemNode.save();
        ensureAssociation(relatedItemNode, findingNode, "vso:hasFinding");

        var relatedEvidenceNodes = relatedItemNode.assocs["vso:relatedEvidence"];
        if (relatedEvidenceNodes) {
          for (var relatedEvidenceIndex = 0; relatedEvidenceIndex < relatedEvidenceNodes.length; relatedEvidenceIndex++) {
            ensureAssociation(findingNode, relatedEvidenceNodes[relatedEvidenceIndex], "vso:relatedEvidence");
          }
        }
      }
    }

    status.code = 200;
    model.success = true;
    model.error = null;
    model.inspection = {
      name: inspectionFolder.name,
      path: inspectionFolder.displayPath + "/" + inspectionFolder.name
    };
    model.domain = {
      name: destinationDomainFolder.name,
      path: destinationDomainFolder.displayPath + "/" + destinationDomainFolder.name
    };
    model.findings = {
      year: findingsYear,
      path: destinationFindingsYearFolder.displayPath + "/" + destinationFindingsYearFolder.name
    };
    model.summary = summary;
    model.importedSources = canonicalDocuments.importedSources;
  }
} catch (runtimeError) {
  if (!model || model.success !== false) {
    setError(500, runtimeError.message);
  }
  logger.error("[import-canonical-models] " + runtimeError.message);
}