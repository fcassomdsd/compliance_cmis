var TARGET_BASE_PATH = "Sites/vigilancia-de-la-so/documentLibrary/Inspecciones/Inspecciones/En proceso";
var PDF_MIMETYPE = "application/pdf";

function fail(message) {
  logger.error("[transformInspectionPlan] " + message);
  throw new Error(message);
}

function getInspectionId(node) {
  var inspectionId = node.properties["vso:inspectionId"];
  if (!inspectionId || String(inspectionId).replace(/\s+/g, "").length === 0) {
    fail("Missing required property vso:inspectionId on source document: " + node.displayPath + "/" + node.name);
  }
  return String(inspectionId);
}

function resolveOrCreateFolder(baseFolder, folderName) {
  var childFolder = baseFolder.childByNamePath(folderName);
  if (childFolder && childFolder.isContainer) {
    return childFolder;
  }
  return baseFolder.createFolder(folderName);
}

function ensureVersionable(node) {
  if (!node.hasAspect("cm:versionable")) {
    node.addAspect("cm:versionable");
  }
}

function setPropertyIfPresent(targetNode, propertyName, value) {
  if (value !== null && value !== undefined && String(value).replace(/\s+/g, "").length > 0) {
    targetNode.properties[propertyName] = value;
  }
}

function syncInspectionContextToFolder(sourceNode, targetFolder, inspectionId) {
  if (!targetFolder.hasAspect("vso:inspectionContext")) {
    targetFolder.addAspect("vso:inspectionContext");
  }

  setPropertyIfPresent(targetFolder, "vso:inspectionId", sourceNode.properties["vso:inspectionId"] || inspectionId);
  setPropertyIfPresent(targetFolder, "vso:locationId", sourceNode.properties["vso:locationId"]);
  setPropertyIfPresent(targetFolder, "vso:locationName", sourceNode.properties["vso:locationName"]);
  targetFolder.save();
}

function updatePdfAsNewVersion(sourceNode, existingNode) {
  ensureVersionable(existingNode);
  var workingCopy = existingNode.checkout();
  sourceNode.transformDocument(PDF_MIMETYPE, workingCopy);
  return workingCopy.checkin("Automatic update from transformInspectionPlan folder rule", false);
}

function execute() {
  if (typeof document === "undefined" || document === null || !document.exists()) {
    fail("Rule script requires a valid 'document' object.");
  }

  var inspectionId = getInspectionId(document);

  var baseFolder = companyhome.childByNamePath(TARGET_BASE_PATH);
  if (!baseFolder || !baseFolder.exists()) {
    fail("Target base folder not found: " + TARGET_BASE_PATH);
  }

  var inspectionFolder = resolveOrCreateFolder(baseFolder, inspectionId);
  syncInspectionContextToFolder(document, inspectionFolder, inspectionId);


  var targetName = document.name.replaceAll(".fodt", "") + ".pdf";

  var existingPdf = inspectionFolder.childByNamePath(targetName);

  if (existingPdf && existingPdf.isDocument) {
    updatePdfAsNewVersion(document, existingPdf);
    logger.log("[transformInspectionPlan] Updated existing PDF as new version: " + inspectionFolder.displayPath + "/" + targetName);
  } else {
    var transformedPdf = document.transformDocument(PDF_MIMETYPE);
    if (!transformedPdf || !transformedPdf.exists()) {
      fail("PDF transformation failed for document: " + document.name);
    }
    transformedPdf.copy(inspectionFolder);
    logger.log("[transformInspectionPlan] Copied new PDF to folder: " + inspectionFolder.displayPath + "/" + targetName);
    transformedPdf.remove();
  }
}

execute();
