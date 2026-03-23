// Path configuration is centralized.
// Maintain folder paths in README.md -> "Path configuration (Alfresco)" and webscripts/common/vso-paths.lib.js.
function resolveVsoPaths() {
  var defaults = {
    inspectionInProcessPath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Inspecciones",
    canonicalSourceBasePath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Datos de campo",
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
var JSON_MIMETYPE = "application/json";

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

  var domain = trimToNull(requestBody.domain);
  var inspectionCode = trimToNull(requestBody.inspectionCode);

  if (domain === null) {
    fail(400, "Missing required field: domain");
  }
  if (inspectionCode === null) {
    fail(400, "Missing required field: inspectionCode");
  }

  return {
    domain: domain,
    inspectionCode: inspectionCode,
    sourceBasePath: trimToNull(requestBody.sourceBasePath) || DEFAULT_SOURCE_BASE_PATH,
    destinationBasePath: trimToNull(requestBody.destinationBasePath) || DEFAULT_DESTINATION_BASE_PATH,
    inspectionType: trimToNull(requestBody.inspectionType),
    inspectionStatus: trimToNull(requestBody.inspectionStatus) || "En proceso",
    startDate: trimToNull(requestBody.startDate),
    endDate: trimToNull(requestBody.endDate)
  };
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
    if (findingPayload && itemIdIndex[findingPayload.itemId]) {
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

  setPropertyIfPresent(inspectionFolder, "cm:title", importRequest.inspectionCode);
  setPropertyIfPresent(inspectionFolder, "vso:inspectionId", checklistData.inspectionCode || importRequest.inspectionCode);
  setPropertyIfPresent(inspectionFolder, "vso:inspectionType", importRequest.inspectionType);
  setDatePropertyIfPresent(inspectionFolder, "vso:startDate", importRequest.startDate);
  setDatePropertyIfPresent(inspectionFolder, "vso:endDate", importRequest.endDate);
  setPropertyIfPresent(inspectionFolder, "vso:inspectionStatus", importRequest.inspectionStatus);
  setPropertyIfPresent(inspectionFolder, "vso:locationId", checklistData.locationId);
  setPropertyIfPresent(inspectionFolder, "vso:locationName", checklistData.locationName);
  setPropertyIfPresent(inspectionFolder, "vso:domain", checklistData.domain || importRequest.domain);
  setPropertyIfPresent(inspectionFolder, "vso:providerId", checklistData.providerId);
  setPropertyIfPresent(inspectionFolder, "vso:providerName", checklistData.providerName);
  inspectionFolder.save();

  summary[inspectionFolderResult.created ? "created" : "updated"]++;

  return inspectionFolder;
}

function upsertDomainFolder(inspectionFolder, checklistPayload, summary) {
  var domainName = trimToNull(checklistPayload.domain) || "GENERAL";
  var domainFolderResult = ensureFolder(inspectionFolder, domainName, null);
  var domainFolder = domainFolderResult.node;

  ensureAspect(domainFolder, "vso:inspectionContext");
  ensureAspect(domainFolder, "vso:serviceContext");

  setPropertyIfPresent(domainFolder, "cm:title", domainName);
  setPropertyIfPresent(domainFolder, "vso:inspectionId", checklistPayload.inspectionCode);
  setPropertyIfPresent(domainFolder, "vso:locationId", checklistPayload.locationId);
  setPropertyIfPresent(domainFolder, "vso:locationName", checklistPayload.locationName);
  setPropertyIfPresent(domainFolder, "vso:domain", checklistPayload.domain);
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

  setPropertyIfPresent(checklistNode, "cm:title", checklistPayload.checklistId);
  setPropertyIfPresent(checklistNode, "vso:contentType", "inspectionChecklist");
  setPropertyIfPresent(checklistNode, "vso:checklistId", checklistPayload.checklistId);
  setPropertyIfPresent(checklistNode, "vso:inspectionId", checklistPayload.inspectionCode);
  setPropertyIfPresent(checklistNode, "vso:locationId", checklistPayload.locationId);
  setPropertyIfPresent(checklistNode, "vso:locationName", checklistPayload.locationName);
  setPropertyIfPresent(checklistNode, "vso:domain", checklistPayload.domain);
  setPropertyIfPresent(checklistNode, "vso:providerId", checklistPayload.providerId);
  setPropertyIfPresent(checklistNode, "vso:providerName", checklistPayload.providerName);
  checklistNode.save();

  summary[checklistResult.created ? "created" : "updated"]++;

  return checklistNode;
}

function upsertEvidence(inspectionFolder, checklistData, itemPayload, sourceDomainFolder, summary) {
  if (!itemPayload.evidence || !itemPayload.evidence.evidenceId) {
    return null;
  }

  // Extract item code for prefixing evidence filenames
  var itemCode = itemPayload.itemCode || itemPayload.itemId;
  
  // Try to find the source evidence file
  var sourceFile = null;
  var evidenceName = itemPayload.evidence.evidenceId;
  var evidenceMode = "json-fallback";
  
  if (itemPayload.evidence.evidenceSource) {
    sourceFile = sourceDomainFolder.childByNamePath(itemPayload.evidence.evidenceSource);
    if (sourceFile && sourceFile.exists()) {
      evidenceName = sourceFile.name;
    } else {
      sourceFile = null;
    }
  }

  // If source file not found by evidenceSource, try to find by evidenceId
  if (!sourceFile) {
    var childFiles = sourceDomainFolder.childFileFolders(false, false);
    for (var idx = 0; idx < childFiles.length; idx++) {
      var candidate = childFiles[idx];
      if (candidate.isDocument && candidate.name.indexOf(itemPayload.evidence.evidenceId) === 0) {
        sourceFile = candidate;
        evidenceName = sourceFile.name;
        break;
      }
    }
  }

  // Prepend item code to evidence filename for easier identification
  if (sourceFile) {
    var lastDot = evidenceName.lastIndexOf('.');
    if (lastDot > 0) {
      var ext = evidenceName.substring(lastDot);
      var baseName = evidenceName.substring(0, lastDot);
      evidenceName = itemCode + "_" + baseName + ext;
    } else {
      evidenceName = itemCode + "_" + evidenceName;
    }
  }

  var evidenceNode = null;
  var evidenceCreated = false;
  var existingEvidenceNode = findDocumentByName(inspectionFolder, evidenceName);

  if (sourceFile) {
    if (existingEvidenceNode && existingEvidenceNode.exists()) {
      existingEvidenceNode.remove();
    }

    sourceFile.move(inspectionFolder);
    evidenceNode = findDocumentByName(inspectionFolder, sourceFile.name);
    if (evidenceNode === null) {
      fail(500, "Failed to move evidence file into destination folder: " + sourceFile.name);
    }

    if (evidenceNode.name !== evidenceName) {
      evidenceNode.name = evidenceName;
    }

    evidenceCreated = existingEvidenceNode === null;
    evidenceMode = "binary-move";

    if (!evidenceNode.isSubType("vso:evidenceItem")) {
      evidenceNode.specializeType("vso:evidenceItem");
    }
  } else if (existingEvidenceNode && existingEvidenceNode.exists()) {
    evidenceNode = existingEvidenceNode;
    evidenceCreated = false;
    evidenceMode = "binary-existing";
  } else {
    var evidenceResult = ensureChildNode(inspectionFolder, evidenceName, "vso:evidenceItem", "cm:contains");
    evidenceNode = evidenceResult.node;
    evidenceCreated = evidenceResult.created;
  }

  ensureVersionable(evidenceNode);
  ensureAspect(evidenceNode, "vso:evidenceIntegrity");
  ensureAspect(evidenceNode, "vso:inspectionContext");
  ensureAspect(evidenceNode, "vso:serviceContext");

  if (!sourceFile) {
    evidenceNode.content = buildJsonContent(itemPayload.evidence);
    evidenceNode.mimetype = JSON_MIMETYPE;
  }

  setPropertyIfPresent(evidenceNode, "cm:title", itemPayload.evidence.evidenceId);
  setPropertyIfPresent(evidenceNode, "vso:contentType", "evidenceItem");
  setPropertyIfPresent(evidenceNode, "vso:evidenceId", itemPayload.evidence.evidenceId);
  setPropertyIfPresent(evidenceNode, "vso:evidenceType", itemPayload.evidence.evidenceType);
  setPropertyIfPresent(evidenceNode, "vso:source", itemPayload.evidence.evidenceSource);
  setPropertyIfPresent(evidenceNode, "vso:inspectionId", checklistData.inspectionCode);
  setPropertyIfPresent(evidenceNode, "vso:locationId", checklistData.locationId);
  setPropertyIfPresent(evidenceNode, "vso:locationName", checklistData.locationName);
  setPropertyIfPresent(evidenceNode, "vso:domain", checklistData.domain);
  setPropertyIfPresent(evidenceNode, "vso:providerId", checklistData.providerId);
  setPropertyIfPresent(evidenceNode, "vso:providerName", checklistData.providerName);
  evidenceNode.properties["vso:immutable"] = false;
  evidenceNode.save();

  if (evidenceMode === "json-fallback") {
    logger.warn("[import-canonical-models] evidence mode=json-fallback itemCode=" + itemCode + " evidenceId=" + itemPayload.evidence.evidenceId + " file=" + evidenceName + " reason=source-file-not-found op=" + (evidenceCreated ? "created" : "updated"));
  } else {
    logger.log("[import-canonical-models] evidence mode=" + evidenceMode + " itemCode=" + itemCode + " evidenceId=" + itemPayload.evidence.evidenceId + " file=" + evidenceName + " op=" + (evidenceCreated ? "created" : "updated"));
  }

  summary[evidenceCreated ? "created" : "updated"]++;

  return evidenceNode;
}

function upsertChecklistItem(checklistNode, checklistData, itemPayload, summary) {
  var itemName = (itemPayload.itemCode || itemPayload.itemId) + ".json";
  var itemResult = ensureChildNode(checklistNode, itemName, "vso:checklistItem", "vso:hasChecklistItem");
  var itemNode = itemResult.node;

  ensureVersionable(itemNode);
  ensureAspect(itemNode, "vso:regulatoryTraceability");
  ensureAspect(itemNode, "vso:inspectionContext");
  ensureAspect(itemNode, "vso:serviceContext");

  itemNode.content = buildJsonContent(itemPayload);
  itemNode.mimetype = JSON_MIMETYPE;

  setPropertyIfPresent(itemNode, "cm:title", itemPayload.itemCode || itemPayload.itemId);
  setPropertyIfPresent(itemNode, "vso:contentType", "checklistItem");
  setPropertyIfPresent(itemNode, "vso:itemId", itemPayload.itemCode);
  setPropertyIfPresent(itemNode, "vso:requirementText", itemPayload.requirement);
  setPropertyIfPresent(itemNode, "vso:itemVerificationMethod", itemPayload.verificationMethod);
  setPropertyIfPresent(itemNode, "vso:complianceStatus", normalizeComplianceStatus(itemPayload.compliance));
  setPropertyIfPresent(itemNode, "vso:inspectorComment", itemPayload.comment);
  setPropertyIfPresent(itemNode, "vso:riskClassification", itemPayload.riskLevel);
  setPropertyIfPresent(itemNode, "vso:inspectionId", checklistData.inspectionCode);
  setPropertyIfPresent(itemNode, "vso:locationId", checklistData.locationId);
  setPropertyIfPresent(itemNode, "vso:locationName", checklistData.locationName);
  setPropertyIfPresent(itemNode, "vso:domain", checklistData.domain);
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

function upsertFinding(inspectionFolder, checklistData, findingPayload, relatedItemPayload, summary) {
  var findingName = findingPayload.findingId + ".json";
  var findingResult = ensureChildNode(inspectionFolder, findingName, "vso:finding", "cm:contains");
  var findingNode = findingResult.node;

  ensureVersionable(findingNode);
  ensureAspect(findingNode, "vso:regulatoryTraceability");
  ensureAspect(findingNode, "vso:inspectionContext");
  ensureAspect(findingNode, "vso:serviceContext");

  findingNode.content = buildJsonContent(findingPayload);
  findingNode.mimetype = JSON_MIMETYPE;

  setPropertyIfPresent(findingNode, "cm:title", findingPayload.findingId);
  setPropertyIfPresent(findingNode, "vso:contentType", "finding");
  setPropertyIfPresent(findingNode, "vso:findingId", findingPayload.findingId);
  setPropertyIfPresent(findingNode, "vso:findingLevel", normalizeFindingLevel(findingPayload.findingLevel));
  setPropertyIfPresent(findingNode, "vso:regulationBreached", findingPayload.requirementBreached);
  setPropertyIfPresent(findingNode, "vso:description", findingPayload.description);
  setPropertyIfPresent(findingNode, "vso:findingStatus", "Open");
  setPropertyIfPresent(findingNode, "vso:inspectionId", checklistData.inspectionCode);
  setPropertyIfPresent(findingNode, "vso:locationId", findingPayload.locationId || checklistData.locationId);
  setPropertyIfPresent(findingNode, "vso:locationName", findingPayload.locationName || checklistData.locationName);
  setPropertyIfPresent(findingNode, "vso:domain", findingPayload.domain || checklistData.domain);
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

  var sourceDomainFolder = sourceBaseFolder.childByNamePath(importRequest.domain);
  if (!sourceDomainFolder || !sourceDomainFolder.exists()) {
    fail(404, "Canonical models domain folder not found: " + importRequest.domain);
  }

  var destinationBaseFolder = companyhome.childByNamePath(importRequest.destinationBasePath);
  if (!destinationBaseFolder || !destinationBaseFolder.exists()) {
    fail(404, "Destination base folder not found: " + importRequest.destinationBasePath);
  }

  var canonicalDocuments = loadCanonicalDocuments(sourceDomainFolder, importRequest.inspectionCode);
  var checklistPayload = canonicalDocuments.checklistDocument.payload.checklist;
  var checklistItems = canonicalDocuments.checklistDocument.payload.items || [];

  if (checklistItems.length === 0) {
    fail(400, "Checklist canonical model does not include items for inspectionCode: " + importRequest.inspectionCode);
  }

  var itemIdIndex = {};
  var itemPayloadById = {};
  for (var itemIndex = 0; itemIndex < checklistItems.length; itemIndex++) {
    itemIdIndex[checklistItems[itemIndex].itemId] = true;
    itemPayloadById[checklistItems[itemIndex].itemId] = checklistItems[itemIndex];
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

  var inspectionFolder = upsertInspectionFolder(destinationBaseFolder, importRequest, checklistPayload, summary);
  var destinationDomainFolder = upsertDomainFolder(inspectionFolder, checklistPayload, summary);
  var checklistNode = upsertChecklist(destinationDomainFolder, checklistPayload, summary);
  var itemNodesById = {};

  for (itemIndex = 0; itemIndex < checklistItems.length; itemIndex++) {
    var checklistItemPayload = checklistItems[itemIndex];
    var itemNode = upsertChecklistItem(checklistNode, checklistPayload, checklistItemPayload, summary);
    itemNodesById[checklistItemPayload.itemId] = itemNode;

    var evidenceNode = upsertEvidence(destinationDomainFolder, checklistPayload, checklistItemPayload, sourceDomainFolder, summary);
    if (evidenceNode !== null) {
      itemNode.save();
      ensureAssociation(itemNode, evidenceNode, "vso:supportedByEvidence");
    }
  }

  for (findingIndex = 0; findingIndex < matchedFindings.length; findingIndex++) {
    var findingPayload = matchedFindings[findingIndex].payload.finding;
    var relatedItemPayload = itemPayloadById[findingPayload.itemId];
    var findingNode = upsertFinding(destinationDomainFolder, checklistPayload, findingPayload, relatedItemPayload, summary);
    var relatedItemNode = itemNodesById[findingPayload.itemId];

    if (relatedItemNode) {
      relatedItemNode.save();
      ensureAssociation(relatedItemNode, findingNode, "vso:hasFinding");
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
  model.summary = summary;
  model.importedSources = canonicalDocuments.importedSources;
} catch (runtimeError) {
  if (!model || model.success !== false) {
    setError(500, runtimeError.message);
  }
  logger.error("[import-canonical-models] " + runtimeError.message);
}