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

function fail(code, message) {
  setError(code, message);
  throw new Error(message);
}

function trimToNull(value) {
  if (value === null || value === undefined) {
    return null;
  }

  var normalized = String(value).replace(/^\s+|\s+$/g, "");
  return normalized.length === 0 ? null : normalized;
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
    inspectionStatus: trimToNull(requestBody.inspectionStatus) || "En proceso",
    startDate: trimToNull(requestBody.startDate),
    endDate: trimToNull(requestBody.endDate)
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
    checklistPayload.inspectionDate,
    checklistPayload.reportDate,
    checklistPayload.date,
    checklistPayload.inspectionCode,
    importRequest.inspectionCode
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
  var inspectionFolderResult = ensureFolder(destinationBaseFolder, importRequest.inspectionCode, "vso:inspection");
  var inspectionFolder = inspectionFolderResult.node;

  ensureAspect(inspectionFolder, "vso:inspectionContext");
  ensureAspect(inspectionFolder, "vso:serviceContext");

  var contextValues = resolveContextValues(checklistData, importRequest);

  setPropertyIfPresent(inspectionFolder, "cm:title", importRequest.inspectionCode);
  setPropertyIfPresent(inspectionFolder, "vso:inspectionId", checklistData.inspectionCode || importRequest.inspectionCode);
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
  var folderName = trimToNull(contextValues.specialtyName) || trimToNull(contextValues.specialtyCode) || trimToNull(contextValues.specialtyId) || "GENERAL";
  var domainFolderResult = ensureFolder(inspectionFolder, folderName, null);
  var domainFolder = domainFolderResult.node;

  ensureAspect(domainFolder, "vso:inspectionContext");
  ensureAspect(domainFolder, "vso:serviceContext");

  setPropertyIfPresent(domainFolder, "cm:title", folderName);
  setPropertyIfPresent(domainFolder, "vso:inspectionId", checklistPayload.inspectionCode);
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

  setPropertyIfPresent(checklistNode, "cm:title", checklistPayload.checklistId);
  setPropertyIfPresent(checklistNode, "vso:contentType", "inspectionChecklist");
  setPropertyIfPresent(checklistNode, "vso:checklistId", checklistPayload.checklistId);
  setPropertyIfPresent(checklistNode, "vso:inspectionId", checklistPayload.inspectionCode);
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

  setPropertyIfPresent(evidenceFolder, "cm:title", "Evidence");
  setPropertyIfPresent(evidenceFolder, "vso:inspectionId", checklistPayload.inspectionCode);
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
  return trimToNull(itemPayload.itemCode) || trimToNull(itemPayload.itemId);
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
    var lastDot = rawName.lastIndexOf('.');
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
  var evidencePayloads = normalizeEvidencePayloads(itemPayload.evidence, itemPayload);
  var evidenceNodes = [];

  for (var evidenceIndex = 0; evidenceIndex < evidencePayloads.length; evidenceIndex++) {
    var evidencePayload = evidencePayloads[evidenceIndex];
    var itemCode = itemPayload.itemCode || itemPayload.itemId;
    var sourceKey = trimToNull(evidencePayload.evidenceSource);
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
    setPropertyIfPresent(evidenceNode, "vso:source", evidencePayload.evidenceSource);
    setPropertyIfPresent(evidenceNode, "vso:inspectionId", checklistData.inspectionCode);
    setPropertyIfPresent(evidenceNode, "vso:locationId", contextValues.locationId);
    setPropertyIfPresent(evidenceNode, "vso:locationCode", contextValues.locationCode);
    setPropertyIfPresent(evidenceNode, "vso:locationName", contextValues.locationName);
    setPropertyIfPresent(evidenceNode, "vso:specialtyId", contextValues.specialtyId);
    setPropertyIfPresent(evidenceNode, "vso:specialtyCode", contextValues.specialtyCode);
    setPropertyIfPresent(evidenceNode, "vso:specialtyName", contextValues.specialtyName);
    setPropertyIfPresent(evidenceNode, "vso:providerId", checklistData.providerId);
    setPropertyIfPresent(evidenceNode, "vso:providerName", checklistData.providerName);
    evidenceNode.properties["vso:immutable"] = false;
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
  setPropertyIfPresent(itemNode, "vso:requirementText", itemPayload.requirement);
  setPropertyIfPresent(itemNode, "vso:itemVerificationMethod", itemPayload.verificationMethod);
  setPropertyIfPresent(itemNode, "vso:complianceStatus", normalizeComplianceStatus(itemPayload.compliance));
  setPropertyIfPresent(itemNode, "vso:inspectorComment", itemPayload.comment);
  setPropertyIfPresent(itemNode, "vso:nominalRisk", resolveNominalRisk(itemPayload));
  setPropertyIfPresent(itemNode, "vso:inspectionId", checklistData.inspectionCode);
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

  setPropertyIfPresent(findingNode, "cm:title", findingPayload.findingId);
  setPropertyIfPresent(findingNode, "vso:contentType", "finding");
  setPropertyIfPresent(findingNode, "vso:findingId", findingPayload.findingId);
  setPropertyIfPresent(findingNode, "vso:findingLevel", normalizeFindingLevel(findingPayload.findingLevel));
  setPropertyIfPresent(findingNode, "vso:riskClassification", findingPayload.riskClassification || findingPayload.riskLevel);
  setPropertyIfPresent(findingNode, "vso:regulationBreached", findingPayload.requirementBreached);
  setPropertyIfPresent(findingNode, "vso:checklistItemCode", findingItemCode);
  setPropertyIfPresent(findingNode, "vso:description", findingPayload.description);
  setPropertyIfPresent(findingNode, "vso:findingStatus", "Open");
  setPropertyIfPresent(findingNode, "vso:inspectionId", checklistData.inspectionCode);
  setPropertyIfPresent(findingNode, "vso:locationId", findingContextValues.locationId || checklistContextValues.locationId);
  setPropertyIfPresent(findingNode, "vso:locationCode", findingContextValues.locationCode || checklistContextValues.locationCode);
  setPropertyIfPresent(findingNode, "vso:locationName", findingContextValues.locationName || checklistContextValues.locationName);
  setPropertyIfPresent(findingNode, "vso:specialtyId", findingContextValues.specialtyId || checklistContextValues.specialtyId);
  setPropertyIfPresent(findingNode, "vso:specialtyCode", findingContextValues.specialtyCode || checklistContextValues.specialtyCode);
  setPropertyIfPresent(findingNode, "vso:specialtyName", findingContextValues.specialtyName || checklistContextValues.specialtyName);
  setPropertyIfPresent(findingNode, "vso:providerId", findingPayload.providerId || checklistData.providerId);
  setPropertyIfPresent(findingNode, "vso:providerName", checklistData.providerName);

  if (relatedItemPayload && relatedItemPayload.reference) {
    setPropertyIfPresent(findingNode, "vso:icaoReference", relatedItemPayload.reference.icaoReference);
    setPropertyIfPresent(findingNode, "vso:nationalRegulation", relatedItemPayload.reference.nationalRegulation);
  }

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

  setPropertyIfPresent(yearFolder, "cm:title", year);
  setPropertyIfPresent(yearFolder, "vso:inspectionId", checklistPayload.inspectionCode);
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
    if (checklistItemCode) {
      itemIdIndex[checklistItemCode] = true;
      itemPayloadById[checklistItemCode] = checklistItem;
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
      ensureAssociation(itemNode, evidenceNodes[evidenceNodeIndex], "vso:supportedByEvidence");
    }
  }

  for (findingIndex = 0; findingIndex < matchedFindings.length; findingIndex++) {
    var findingPayload = matchedFindings[findingIndex].payload.finding;
    var findingItemCode = resolveItemCode(findingPayload || {});
    var relatedItemPayload = itemPayloadById[findingItemCode];
    var findingNode = upsertFinding(destinationFindingsYearFolder, checklistPayload, findingPayload, findingItemCode, relatedItemPayload, summary);
    var relatedItemNode = itemNodesById[findingItemCode];

    if (relatedItemNode) {
      relatedItemNode.save();
      ensureAssociation(relatedItemNode, findingNode, "vso:hasFinding");

      var relatedEvidenceNodes = relatedItemNode.assocs["vso:supportedByEvidence"];
      if (relatedEvidenceNodes) {
        for (var relatedEvidenceIndex = 0; relatedEvidenceIndex < relatedEvidenceNodes.length; relatedEvidenceIndex++) {
          ensureAssociation(findingNode, relatedEvidenceNodes[relatedEvidenceIndex], "vso:findingSupportedByEvidence");
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
} catch (runtimeError) {
  if (!model || model.success !== false) {
    setError(500, runtimeError.message);
  }
  logger.error("[import-canonical-models] " + runtimeError.message);
}