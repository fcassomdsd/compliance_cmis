// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

// Locale-keyed label dictionaries for the three routine .fodt report templates
// (Finding/Checklist/FollowUp Reporte). Keys correspond to ${labels.<key>}
// placeholders in the templates under templates/. Add new locales here.
var REPORT_LABELS = {
  findingReport: {
    en: {
      inspectionFinding: "Inspection Finding",
      identification: "Identification",
      findingId: "Finding ID:",
      checklistItem: "Checklist Item:",
      location: "Location:",
      specialty: "Specialty:",
      provider: "Provider:",
      findingDetail: "Finding Detail",
      description: "Description:",
      requirementBreached: "Requirement Breached:",
      iCAOReference: "ICAO Reference:",
      nationalRegulation: "National Regulation:",
      regulationItem: "Regulation Item:",
      level: "Level:",
      severity: "Severity:",
      riskClassification: "Risk Classification:",
      targetResidualRisk: "Target Residual Risk:",
      achievedResidualRisk: "Achieved Residual Risk:",
      statusAndDates: "Status and Dates",
      status: "Status:",
      dateIssued: "Date Issued:",
      cAPSubmissionDeadline: "CAP Submission Deadline:",
      resolutionDeadline: "Resolution Deadline:",
      closureDate: "Closure Date:",
      correctiveAction: "Corrective Action",
      cAPId: "CAP ID:",
      proposedAction: "Proposed Action:",
      responsibleEntity: "Responsible Entity:",
      dueDate: "Due Date:",
      acceptanceStatus: "Acceptance Status:",
    },
    es: {
      inspectionFinding: "Hallazgo de Inspección",
      identification: "Identificación",
      findingId: "ID de Hallazgo:",
      checklistItem: "Elemento de Checklist:",
      location: "Ubicación:",
      specialty: "Especialidad:",
      provider: "Proveedor:",
      findingDetail: "Detalle del Hallazgo",
      description: "Descripción:",
      requirementBreached: "Requisito Incumplido:",
      iCAOReference: "Referencia OACI:",
      nationalRegulation: "Reglamento Nacional:",
      regulationItem: "Artículo:",
      level: "Nivel:",
      severity: "Severidad:",
      riskClassification: "Clasificación de Riesgo:",
      targetResidualRisk: "Riesgo Residual Objetivo:",
      achievedResidualRisk: "Riesgo Residual Alcanzado:",
      statusAndDates: "Estado y Fechas",
      status: "Estado:",
      dateIssued: "Fecha de Emisión:",
      cAPSubmissionDeadline: "Plazo de Envío de CAP:",
      resolutionDeadline: "Plazo de Resolución:",
      closureDate: "Fecha de Cierre:",
      correctiveAction: "Acción Correctiva",
      cAPId: "ID de CAP:",
      proposedAction: "Acción Propuesta:",
      responsibleEntity: "Entidad Responsable:",
      dueDate: "Fecha Límite:",
      acceptanceStatus: "Estado de Aceptación:",
    },
  },
  checklistReport: {
    en: {
      inspectionChecklist: "Inspection Checklist",
      generalInformation: "General Information",
      inspectionCode: "Inspection Code:",
      location: "Location:",
      specialty: "Specialty:",
      provider: "Provider:",
      scope: "Scope:",
      completionDate: "Completion Date:",
      interviewee: "Interviewee:",
      checklistId: "Checklist ID:",
      checklistItems: "Checklist Items",
      verificationMethod: "Verification Method:",
      complianceStatus: "Compliance Status:",
      riskLevel: "Risk Level:",
      inspectorComment: "Inspector Comment:",
      iCAOReference: "ICAO Reference:",
      nationalRegulation: "National Regulation:",
      regulationItem: "Regulation Item:",
      openPriorFinding: "Open Prior Finding:",
      evidenceId: "Evidence ID",
      type: "Type",
      role: "Role",
      source: "Source",
      collectionDate: "Collection Date",
    },
    es: {
      inspectionChecklist: "Checklist de Inspección",
      generalInformation: "Datos Generales",
      inspectionCode: "Código de Inspección:",
      location: "Ubicación:",
      specialty: "Especialidad:",
      provider: "Proveedor:",
      scope: "Alcance:",
      completionDate: "Fecha de Finalización:",
      interviewee: "Entrevistado:",
      checklistId: "ID de Checklist:",
      checklistItems: "Elementos de Verificación",
      verificationMethod: "Método de Verificación:",
      complianceStatus: "Estado de Cumplimiento:",
      riskLevel: "Nivel de Riesgo:",
      inspectorComment: "Comentario del Inspector:",
      iCAOReference: "Referencia OACI:",
      nationalRegulation: "Reglamento Nacional:",
      regulationItem: "Artículo:",
      openPriorFinding: "Hallazgo Previo Abierto:",
      evidenceId: "ID de Evidencia",
      type: "Tipo",
      role: "Rol",
      source: "Fuente",
      collectionDate: "Fecha de Recolección",
    },
  },
  followUpReport: {
    en: {
      followupReport: "Follow-up Report",
      identification: "Identification",
      followupId: "Follow-up ID:",
      findingId: "Finding ID:",
      cAPId: "CAP ID:",
      location: "Location:",
      specialty: "Specialty:",
      provider: "Provider:",
      followupDetail: "Follow-up Detail",
      followupType: "Follow-up Type:",
      followupDate: "Follow-up Date:",
      percentComplete: "Percent Complete:",
      currentResidualRisk: "Current Residual Risk:",
      comment: "Comment:",
      closure: "Closure",
      effectivenessConfirmed: "Effectiveness Confirmed:",
      closureVerificationMethod: "Closure Verification Method:",
      followupClosureDate: "Follow-up Closure Date:",
      evidence: "Evidence",
      evidenceId: "Evidence ID",
      type: "Type",
      role: "Role",
      source: "Source",
      collectionDate: "Collection Date",
    },
    es: {
      followupReport: "Reporte de Seguimiento",
      identification: "Identificación",
      followupId: "ID de Seguimiento:",
      findingId: "ID de Hallazgo:",
      cAPId: "ID de CAP:",
      location: "Ubicación:",
      specialty: "Especialidad:",
      provider: "Proveedor:",
      followupDetail: "Detalle del Seguimiento",
      followupType: "Tipo de Seguimiento:",
      followupDate: "Fecha de Seguimiento:",
      percentComplete: "Porcentaje Completado:",
      currentResidualRisk: "Riesgo Residual Actual:",
      comment: "Comentario:",
      closure: "Cierre",
      effectivenessConfirmed: "Efectividad Confirmada:",
      closureVerificationMethod: "Método de Verificación de Cierre:",
      followupClosureDate: "Fecha de Cierre de Seguimiento:",
      evidence: "Evidencia",
      evidenceId: "ID de Evidencia",
      type: "Tipo",
      role: "Rol",
      source: "Fuente",
      collectionDate: "Fecha de Recolección",
    },
  },
};

function resolveReportLocale(requestBody) {
  var locale = trimToNull(requestBody && requestBody.locale);
  return (locale === "en") ? "en" : "es";
}

function getReportLabels(templateKey, locale) {
  var templateLabels = REPORT_LABELS[templateKey] || {};
  return templateLabels[locale] || templateLabels.es || {};
}

// Path configuration is centralized.
// Maintain folder paths in README.md -> "Path configuration (Alfresco)" and webscripts/common/vso-paths.lib.js.
function resolveVsoPaths() {
  var defaults = {
    inspectionInProcessPath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Inspecciones",
    canonicalSourceBasePath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Datos de campo",
    findingBasePath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Hallazgos",
    inspectionPlanTemplateDataPath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Template data",
    checklistPdfTemplatePath: "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/Checklist Reporte.fodt",
    findingPdfTemplatePath: "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/Finding Reporte.fodt",
    followUpPdfTemplatePath: "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/FollowUp Reporte.fodt"
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
var CHECKLIST_PDF_TEMPLATE_PATH = VSO_PATHS.checklistPdfTemplatePath;
var FINDING_PDF_TEMPLATE_PATH = VSO_PATHS.findingPdfTemplatePath;
var FOLLOWUP_PDF_TEMPLATE_PATH = VSO_PATHS.followUpPdfTemplatePath;

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
      if (normalized.indexOf("P-") === 0) {
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

function resolveUsoapTagHelpers() {
  if (typeof __VSO_USOAP_TAG_HELPERS !== "undefined" && __VSO_USOAP_TAG_HELPERS) {
    return __VSO_USOAP_TAG_HELPERS;
  }

  if (typeof importScript === "function") {
    var candidates = [
      "../common/vso-usoap-tags.lib.js",
      "classpath:alfresco/extension/templates/webscripts/common/vso-usoap-tags.lib.js"
    ];

    for (var index = 0; index < candidates.length; index++) {
      try {
        importScript(candidates[index]);
        if (typeof __VSO_USOAP_TAG_HELPERS !== "undefined" && __VSO_USOAP_TAG_HELPERS) {
          return __VSO_USOAP_TAG_HELPERS;
        }
      } catch (error) {
      }
    }
  }

  // Fallback: reimplements the same two functions using this file's own
  // ensureAspect/setPropertyIfPresent/setMultiPropertyIfPresent, in case the
  // shared lib cannot be imported in this environment.
  return {
    applyChainDerivedUsoapTags: function(node, usoapPqReference) {
      if (!usoapPqReference || !usoapPqReference.length) {
        return;
      }
      ensureAspect(node, "vso:usoapEvidenceContext");

      var pqCodes = [];
      var ceValues = [];
      var areaValues = [];
      for (var i = 0; i < usoapPqReference.length; i++) {
        var entry = usoapPqReference[i] || {};
        if (entry.code) pqCodes.push(entry.code);
        if (entry.criticalElement) ceValues.push(entry.criticalElement);
        if (entry.areaCode) areaValues.push(entry.areaCode);
      }

      setMultiPropertyIfPresent(node, "vso:usoapPqReference", pqCodes);
      setMultiPropertyIfPresent(node, "vso:ceMapping", ceValues);
      setMultiPropertyIfPresent(node, "vso:areaMapping", areaValues);
      setPropertyIfPresent(node, "vso:usoapCriticalElement", usoapPqReference[0].criticalElement);
      setPropertyIfPresent(node, "vso:usoapAreaCode", usoapPqReference[0].areaCode);
      setPropertyIfPresent(node, "vso:usoapTagSource", "Chain-derived");
    },
    inheritUsoapTags: function(targetNode, sourceNode) {
      if (!sourceNode || !sourceNode.hasAspect("vso:usoapEvidenceContext")) {
        return;
      }
      ensureAspect(targetNode, "vso:usoapEvidenceContext");

      var scalarProps = ["vso:usoapCriticalElement", "vso:usoapAreaCode", "vso:usoapTagSource"];
      for (var si = 0; si < scalarProps.length; si++) {
        var value = sourceNode.properties[scalarProps[si]];
        if (value !== null && value !== undefined && value !== "") {
          targetNode.properties[scalarProps[si]] = value;
        }
      }

      var multiProps = ["vso:usoapPqReference", "vso:ceMapping", "vso:areaMapping"];
      for (var mi = 0; mi < multiProps.length; mi++) {
        var multiValue = sourceNode.properties[multiProps[mi]];
        if (multiValue && multiValue.length) {
          targetNode.properties[multiProps[mi]] = multiValue;
        }
      }
    }
  };
}

var USOAP_TAG_HELPERS = resolveUsoapTagHelpers();

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

// Activity type letter used in activity codes: A=Auditoría, I=Inspección,
// M=Monitoreo, D=Revisión documental, S=Análisis de suceso. Not constrained to
// that set here — ActivityType is a reference entity owned by the AtroCore
// backend and fetched dynamically, so this only enforces the shape.
function resolveActivityTypeToken(source, importRequest) {
  var token = sanitizeUpperToken(firstNonEmpty(
    source ? source.activityTypeCode : null,
    source ? source.activityType : null,
    importRequest ? importRequest.activityTypeCode : null,
    importRequest ? importRequest.activityType : null
  ));

  if (token === null || !/^[A-Z]$/.test(token)) {
    return null;
  }

  return token;
}

// Activity code (Actividad de vigilancia): AV-XXXX-T-#### (for example AV-MDSD-A-0002).
// The activity is sequenced independently per location + activity type; it is NOT
// derived from, and carries no relationship to, its parent site-visit code. Whatever
// AV- code upstream (compliance_web) assigns is accepted as-is, and the compact form
// XXXXT#### (dashes and the AV- prefix stripped) is derived from it for use inside
// checklist/finding/CAP/follow-up ids.
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
    var hyphenMatch = String(seedText).toUpperCase().match(/^(?:AV-)?([A-Z]{4})-([A-Z])-(\d{1,4})$/);
    if (hyphenMatch) {
      var directSeq = padNumber(hyphenMatch[3], 4);
      if (directSeq !== null) {
        return {
          locationCode: hyphenMatch[1],
          activityTypeCode: hyphenMatch[2],
          sequence: directSeq
        };
      }
    }

    var compactMatch = String(seedText).toUpperCase().match(/^([A-Z]{4})([A-Z])(\d{4})$/);
    if (compactMatch) {
      return {
        locationCode: compactMatch[1],
        activityTypeCode: compactMatch[2],
        sequence: compactMatch[3]
      };
    }
  }

  // Fallback: rebuild the key from discrete context fields. Requires an explicit
  // activity type — there is no safe default letter to invent.
  var activityTypeCode = resolveActivityTypeToken(source, importRequest);
  var sequenceFromSeed = padNumber(extractTrailingDigits(seedText), 4);
  if (preferredLocationCode && activityTypeCode && sequenceFromSeed) {
    return {
      locationCode: preferredLocationCode.substring(0, 4),
      activityTypeCode: activityTypeCode,
      sequence: sequenceFromSeed
    };
  }

  return null;
}

function buildInspectionId(key) {
  if (!key) {
    return null;
  }
  return "AV-" + key.locationCode + "-" + key.activityTypeCode + "-" + key.sequence;
}

function buildInspectionCompactId(key) {
  if (!key) {
    return null;
  }
  return key.locationCode + key.activityTypeCode + key.sequence;
}

function resolveSpecialtyToken(source, importRequest) {
  return sanitizeUpperToken(firstNonEmpty(
    source ? source.specialtyCode : null,
    source ? source.specialtyId : null,
    importRequest ? importRequest.specialtyCode : null,
    importRequest ? importRequest.specialtyId : null
  ));
}

// Checklist id (Lista de verificación): LV-XXXXT####-EEE (for example LV-MDSDA0002-COM).
function buildChecklistId(inspectionCompactId, specialtyToken) {
  if (!inspectionCompactId || !specialtyToken) {
    return null;
  }
  return "LV-" + inspectionCompactId + "-" + specialtyToken;
}

function resolveFindingSequence(findingPayload, fallbackSequence) {
  var fromFindingId = padNumber(extractTrailingDigits(findingPayload ? findingPayload.findingId : null), 3);
  if (fromFindingId !== null) {
    return fromFindingId;
  }

  return padNumber(fallbackSequence, 3);
}

// Finding id (Hallazgo): H-XXXXT####-EEE-### (for example H-MDSDA0002-COM-001).
// Must stay consistent with parseFindingParts() in webscripts/common/vso-follow-up.lib.js,
// which decomposes this id to build the CAP (P-) and follow-up (S-) ids.
function buildFindingId(inspectionCompactId, specialtyToken, findingSequence) {
  if (!inspectionCompactId || !specialtyToken || !findingSequence) {
    return null;
  }
  return "H-" + inspectionCompactId + "-" + specialtyToken + "-" + findingSequence;
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
  checklistPayload.activityTypeCode = inspectionKey.activityTypeCode;

  return {
    inspectionId: inspectionId,
    inspectionCompactId: inspectionCompactId,
    activityTypeCode: inspectionKey.activityTypeCode,
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

function setMultiPropertyIfPresent(node, propertyName, values) {
  if (!values || !values.length) {
    return;
  }
  var normalized = [];
  for (var index = 0; index < values.length; index++) {
    var trimmed = trimToNull(values[index]);
    if (trimmed !== null && normalized.indexOf(trimmed) === -1) {
      normalized.push(trimmed);
    }
  }
  if (normalized.length) {
    node.properties[propertyName] = normalized;
  }
}

// applyChainDerivedUsoapTags / inheritUsoapTags now live in
// USOAP_TAG_HELPERS (webscripts/common/vso-usoap-tags.lib.js), shared with
// webscripts/usoap/apply-direct-usoap-tag.post.js. See resolveUsoapTagHelpers()
// above.

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

// Looks up a canonical checklist/finding/follow-up node by its .pdf name
// first (the steady-state name after content has been replaced with PDF),
// falling back to the original .json-suffixed lookup-or-create. Covers three
// cases: first-ever import (neither exists, creates as .json - gets renamed
// to .pdf once replaceContentWithPdf() succeeds), a normal re-import of an
// already-PDF'd node (found by its .pdf name), and a node whose previous PDF
// generation failed and was left named .json (found by the .json fallback,
// self-healing to .pdf on the next successful generation).
function ensureCanonicalDocumentNode(parentNode, jsonStyleName, nodeType, assocType) {
  var pdfStyleName = jsonStyleName.replace(/\.json$/i, ".pdf");
  var existingPdf = parentNode.childByNamePath(pdfStyleName);
  if (existingPdf && existingPdf.exists()) {
    if (!existingPdf.isSubType(nodeType)) {
      existingPdf.specializeType(nodeType);
    }
    return { node: existingPdf, created: false, pdfName: pdfStyleName };
  }

  var result = ensureChildNode(parentNode, jsonStyleName, nodeType, assocType);
  return { node: result.node, created: result.created, pdfName: pdfStyleName };
}

// importScript() is not available in this webscript's execution context (verified:
// typeof importScript === "undefined" here), so the MiniFreemarker renderer used for
// PDF companion templates is inlined rather than loaded from
// webscripts/common/vso-paths.lib.js's TemplateGeneration module. This mirrors the
// same inline-fallback approach generate-inspection-report.post.js already uses.
function renderPdfTemplateContent(templateContent, data) {
  function tokenize(input) {
    var tokens = [];
    var index = 0;

    while (index < input.length) {
      if (input.indexOf("${", index) === index) {
        var variableEnd = input.indexOf("}", index);
        if (variableEnd === -1) {
          throw new Error("Unclosed ${ expression");
        }
        tokens.push({ type: "variable", value: input.slice(index + 2, variableEnd).trim() });
        index = variableEnd + 1;
        continue;
      }

      if (input.indexOf("[#list", index) === index) {
        var listEnd = input.indexOf("]", index);
        if (listEnd === -1) {
          throw new Error("Unclosed [#list]");
        }
        tokens.push({ type: "list_open", value: input.slice(index + 6, listEnd).trim() });
        index = listEnd + 1;
        continue;
      }

      if (input.indexOf("[/#list]", index) === index) {
        tokens.push({ type: "list_close" });
        index += 8;
        continue;
      }

      var nextTokenIndex = findNextSpecial(input, index);
      if (nextTokenIndex > index) {
        tokens.push({ type: "text", value: input.slice(index, nextTokenIndex) });
      }
      index = nextTokenIndex;
    }

    return tokens;
  }

  function findNextSpecial(input, start) {
    var markers = ["${", "[#list", "[/#list]"];
    var nearest = input.length;
    for (var markerIndex = 0; markerIndex < markers.length; markerIndex++) {
      var markerPos = input.indexOf(markers[markerIndex], start);
      if (markerPos !== -1 && markerPos < nearest) {
        nearest = markerPos;
      }
    }
    return nearest;
  }

  function parse(tokens) {
    function parseToken(token, tokenList) {
      if (token.type === "text") {
        return { count: 1, data: token };
      }
      if (token.type === "variable") {
        return { count: 1, data: { type: "variable", path: token.value } };
      }
      if (token.type === "list_open") {
        var parts = token.value.split(/\s+/);
        if (parts.length !== 3 || parts[1] !== "as") {
          throw new Error("Invalid [#list] syntax: " + token.value);
        }
        var body = parse(tokenList);
        return {
          count: body.count + 2,
          data: { type: "list", collection: parts[0], item: parts[2], body: body.data }
        };
      }
      return { count: 1, data: null };
    }

    var nodes = [];
    var tokenIndex = 0;
    while (tokenIndex < tokens.length && tokens[tokenIndex].type !== "list_close") {
      var node = parseToken(tokens[tokenIndex], tokens.slice(tokenIndex + 1));
      nodes.push(node.data);
      tokenIndex += node.count;
    }
    return { count: tokenIndex, data: nodes };
  }

  function resolvePath(objectRoot, path) {
    var context = objectRoot;
    var parts = String(path).split(".");
    for (var index = 0; index < parts.length; index++) {
      if (!context || typeof context !== "object") {
        return "";
      }
      var part = parts[index];
      if (!(part in context)) {
        return "";
      }
      context = context[part];
    }
    if (context === null || context === undefined) {
      return "";
    }
    return context;
  }

  function evaluate(nodes, context) {
    function evaluateNode(node, currentContext) {
      if (!node) {
        return "";
      }
      if (node.type === "text") {
        return node.value;
      }
      if (node.type === "variable") {
        return resolvePath(currentContext, node.path);
      }
      if (node.type === "list") {
        var collection = resolvePath(currentContext, node.collection);
        if (!Array.isArray(collection)) {
          return "";
        }
        var listOutput = "";
        for (var elementIndex = 0; elementIndex < collection.length; elementIndex++) {
          var itemContext = Object.create(currentContext || {});
          itemContext[node.item] = collection[elementIndex];
          listOutput += evaluate(node.body, itemContext);
        }
        return listOutput;
      }
      return "";
    }

    var output = "";
    for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
      output += evaluateNode(nodes[nodeIndex], context);
    }
    return output;
  }

  var ast = parse(tokenize(templateContent));
  return evaluate(ast.data, data);
}

// Recursively XML-escapes string leaves so free-text fields (comments,
// descriptions, etc.) can't break the FODT XML markup they get substituted
// into. The MiniFreemarker engine does plain string substitution with no
// escaping of its own, so this must happen before renderTemplateContent().
function xmlEscapeDeep(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    var escapedArray = [];
    for (var arrayIndex = 0; arrayIndex < value.length; arrayIndex++) {
      escapedArray.push(xmlEscapeDeep(value[arrayIndex]));
    }
    return escapedArray;
  }
  if (typeof value === "object") {
    var escapedObject = {};
    for (var key in value) {
      if (value.hasOwnProperty(key)) {
        escapedObject[key] = xmlEscapeDeep(value[key]);
      }
    }
    return escapedObject;
  }
  if (typeof value === "string") {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  return value;
}

// Renders templatePath (a .fodt) with `data`, converts it to PDF via Alfresco's
// local Transform Service, and stores it as pdfFileName in destinationFolder,
// alongside the JSON document it companions. Best-effort: any failure is logged
// and swallowed so the canonical JSON import (the load-bearing operation, which
// has already completed by the time this runs) is never failed because of it.
// Renders templatePath (a .fodt) with `data`, converts it to PDF via Alfresco's
// local Transform Service, and replaces targetNode's own content with it in
// place (same nodeRef, same properties/associations - no sibling node is
// created). scratchFolder is a real folder to create the transient rendering
// artifacts in; it can't always be targetNode.parent (e.g. a follow-up
// report's parent is a vso:finding node, not a folder, and can't hold an
// arbitrary child via the generic cm:contains association).
// Best-effort: any failure is logged and swallowed, leaving targetNode's
// existing content/mimetype/name completely untouched - properties are set
// independently of this and are never affected either way.
function replaceContentWithPdf(targetNode, scratchFolder, templatePath, data, desiredFileName, aspects) {
  var scratchNode = null;
  var transformedNode = null;
  try {
    var templateNode = companyhome.childByNamePath(templatePath);
    if (!templateNode || !templateNode.exists()) {
      logger.warn("[import-canonical-models] pdf-render skipped for " + desiredFileName + ": template not found at " + templatePath);
      return false;
    }

    var renderedFodt = renderPdfTemplateContent(String(templateNode.content), xmlEscapeDeep(data));
    var baseName = desiredFileName.replace(/\.pdf$/i, "");
    scratchNode = scratchFolder.createNode("._pdf-render-" + baseName + ".fodt", "cm:content");
    scratchNode.content = renderedFodt;
    scratchNode.mimetype = "application/vnd.oasis.opendocument.text";
    scratchNode.save();

    transformedNode = (typeof scratchNode.transformDocument === "function") ? scratchNode.transformDocument("application/pdf") : null;
    if (!transformedNode) {
      logger.warn("[import-canonical-models] pdf-render skipped for " + desiredFileName + ": PDF transform returned no result");
      scratchNode.remove();
      return false;
    }

    targetNode.properties.content.write(transformedNode.properties.content);
    targetNode.properties.content.mimetype = "application/pdf";
    if (targetNode.name !== desiredFileName) {
      targetNode.name = desiredFileName;
    }
    for (var aspectIndex = 0; aspectIndex < aspects.length; aspectIndex++) {
      ensureAspect(targetNode, aspects[aspectIndex]);
    }
    targetNode.save();

    transformedNode.remove();
    scratchNode.remove();

    logger.log("[import-canonical-models] pdf-render replaced content: " + desiredFileName);
    return true;
  } catch (pdfError) {
    logger.warn("[import-canonical-models] pdf-render failed for " + desiredFileName + ": " + pdfError.toString());
    try {
      if (transformedNode) {
        transformedNode.remove();
      }
      if (scratchNode) {
        scratchNode.remove();
      }
    } catch (cleanupError) {
    }
    return false;
  }
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
    activityTypeId: trimToNull(requestBody.activityTypeId),
    activityTypeCode: trimToNull(requestBody.activityTypeCode) || trimToNull(requestBody.activityType),
    activityTypeName: trimToNull(requestBody.activityTypeName),
    inspectionStatus: trimToNull(requestBody.inspectionStatus) || "Reported",
    startDate: trimToNull(requestBody.startDate),
    endDate: trimToNull(requestBody.endDate),
    locale: resolveReportLocale(requestBody)
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
    // Evidence reaching Alfresco through this canonical-import path always
    // came from the field app's on-site follow-up collection flow — never
    // set for any other evidence-creation path (compliance_web's own
    // upload endpoint sets Remote/Provider-submitted directly).
    setPropertyIfPresent(evidenceNode, "vso:collectionMethod", "On-site");
    setPropertyIfPresent(evidenceNode, "vso:hashValue", evidencePayload.hashValue);
    setDatePropertyIfPresent(evidenceNode, "vso:sealedDate", evidencePayload.sealedDate);
    if (evidencePayload.immutable !== null && evidencePayload.immutable !== undefined) {
      evidenceNode.properties["vso:immutable"] = !!evidencePayload.immutable;
    }
    USOAP_TAG_HELPERS.inheritUsoapTags(evidenceNode, findingNode);
    evidenceNode.save();

    ensureAssociation(followUpNode, evidenceNode, "vso:relatedEvidence");
    summary[created ? "created" : "updated"]++;
    summary.evidenceImported++;
  }
}

function upsertFollowUpFromCanonicalFile(followUpFileNode, sourceRootFolder, summary, reportLocale) {
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
  var followUpResult = ensureCanonicalDocumentNode(findingNode, followUpNodeName, "vso:followUpReport", "vso:hasFollowUp");
  var followUpNode = followUpResult.node;

  ensureVersionable(followUpNode);
  ensureAspect(followUpNode, "vso:inspectionContext");
  ensureAspect(followUpNode, "vso:serviceContext");

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
    // Closing a finding is a two-step gate: a valid Closure Verification
    // follow-up only makes it eligible for closure, it does not close the
    // finding directly. A separate reviewer must approve via
    // compliance_web's PATCH /findings/:findingId/closure-review before
    // vso:findingStatus becomes "Closed" and vso:findingClosureDate is set.
    var now = new Date();
    findingNode.properties["vso:findingStatus"] = "Pending Closure Approval";
    findingNode.properties["vso:lastStatusChange"] = now;
    findingNode.save();
    summary.pendingClosureApprovals++;
  }

  replaceContentWithPdf(
    followUpNode,
    findingNode.parent,
    FOLLOWUP_PDF_TEMPLATE_PATH,
    {
      followUpId: report.followUpId,
      findingId: findingId,
      followUpType: report.followUpType,
      followUpDate: report.followUpDate,
      percentComplete: report.percentComplete,
      followUpClosureDate: report.followUpClosureDate,
      closureVerificationMethod: report.closureVerificationMethod,
      effectivenessConfirmed: report.effectivenessConfirmed,
      currentResidualRisk: report.currentResidualRisk,
      followUpComment: report.followUpComment,
      capId: report.capId,
      locationName: firstNonEmpty(report.locationName, findingNode.properties["vso:locationName"]),
      specialtyName: firstNonEmpty(report.specialtyName, findingNode.properties["vso:specialtyName"]),
      providerName: firstNonEmpty(report.providerName, findingNode.properties["vso:providerName"]),
      labels: getReportLabels("followUpReport", reportLocale),
      evidenceItems: report.evidenceItems
    },
    followUpResult.pdfName,
    ["vso:inspectionContext", "vso:serviceContext"]
  );

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
    pendingClosureApprovals: 0,
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

    var fileResult = upsertFollowUpFromCanonicalFile(fileMatches[0], sourceRootFolder, summary, resolveReportLocale(requestBody));
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

  var activityTypeId = firstNonEmpty(src.activityTypeId, req.activityTypeId);
  var activityTypeCode = firstNonEmpty(src.activityTypeCode, src.activityType, req.activityTypeCode, req.activityType);
  var activityTypeName = firstNonEmpty(src.activityTypeName, req.activityTypeName);

  return {
    locationId: locationId,
    locationCode: locationCode,
    locationName: locationName,
    specialtyId: specialtyId,
    specialtyCode: specialtyCode,
    specialtyName: specialtyName,
    activityTypeId: activityTypeId,
    activityTypeCode: activityTypeCode,
    activityTypeName: activityTypeName
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

// Callers of this webscript do not agree on whether "inspectionCode" carries
// the "AV-" activity-code prefix: compliance_flow's /importCanonical resolves
// and sends the Inspection entity's own code (with the prefix), while
// compliance_import's checklist/finding payloads carry the prefix-stripped
// "XXXX-T-####" form (see resolveInspectionKey's identical (?:AV-)? handling
// above). Compare the normalized key, not the raw strings, so a checklist
// stored under one form is still found when looked up under the other.
function normalizeInspectionCodeForCompare(value) {
  var text = trimToNull(value);
  if (text === null) {
    return null;
  }
  var hyphenMatch = String(text).toUpperCase().match(/^(?:AV-)?([A-Z]{4})-([A-Z])-(\d{1,4})$/);
  if (hyphenMatch) {
    var seq = padNumber(hyphenMatch[3], 4);
    if (seq !== null) {
      return hyphenMatch[1] + hyphenMatch[2] + seq;
    }
  }
  var compactMatch = String(text).toUpperCase().match(/^([A-Z]{4})([A-Z])(\d{4})$/);
  if (compactMatch) {
    return compactMatch[1] + compactMatch[2] + compactMatch[3];
  }
  return String(text).toUpperCase();
}

function loadCanonicalDocuments(domainFolder, inspectionCode) {
  var documents = domainFolder.childFileFolders(true, false);
  var checklistDocument = null;
  var findingDocuments = [];
  var importedSources = [];
  var normalizedTarget = normalizeInspectionCodeForCompare(inspectionCode);

  for (var index = 0; index < documents.length; index++) {
    var documentNode = documents[index];
    if (!documentNode.isDocument || documentNode.name.toLowerCase().indexOf(".json") === -1) {
      continue;
    }

    var payload = parseJsonContent(documentNode);
    if (payload.checklist && normalizedTarget !== null &&
        normalizeInspectionCodeForCompare(payload.checklist.inspectionCode) === normalizedTarget) {
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
  setPropertyIfPresent(inspectionFolder, "vso:activityTypeId", importRequest.activityTypeId);
  setPropertyIfPresent(inspectionFolder, "vso:activityTypeCode", importRequest.activityTypeCode);
  setPropertyIfPresent(inspectionFolder, "vso:activityTypeName", importRequest.activityTypeName);
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
  setPropertyIfPresent(domainFolder, "vso:activityTypeId", contextValues.activityTypeId);
  setPropertyIfPresent(domainFolder, "vso:activityTypeCode", contextValues.activityTypeCode);
  setPropertyIfPresent(domainFolder, "vso:activityTypeName", contextValues.activityTypeName);
  setPropertyIfPresent(domainFolder, "vso:providerId", checklistPayload.providerId);
  setPropertyIfPresent(domainFolder, "vso:providerName", checklistPayload.providerName);
  domainFolder.save();

  summary[domainFolderResult.created ? "created" : "updated"]++;

  return domainFolder;
}

function upsertChecklist(domainFolder, checklistPayload, summary) {
  var checklistName = checklistPayload.checklistId + ".json";
  var checklistResult = ensureCanonicalDocumentNode(domainFolder, checklistName, "vso:inspectionChecklist", "cm:contains");
  var checklistNode = checklistResult.node;

  ensureVersionable(checklistNode);
  ensureAspect(checklistNode, "vso:inspectionContext");
  ensureAspect(checklistNode, "vso:serviceContext");

  var contextValues = resolveContextValues(checklistPayload, null);
  var inspectionIdentifier = resolveInspectionIdentifier(checklistPayload, null);

  setPropertyIfPresent(checklistNode, "cm:title", checklistPayload.checklistId);
  setPropertyIfPresent(checklistNode, "vso:contentType", "inspectionChecklist");
  setPropertyIfPresent(checklistNode, "vso:checklistId", checklistPayload.checklistId);
  setPropertyIfPresent(checklistNode, "vso:scope", checklistPayload.scope);
  setDatePropertyIfPresent(checklistNode, "vso:completionDate", checklistPayload.completionDate);
  setPropertyIfPresent(checklistNode, "vso:interviewee", checklistPayload.interviewee);
  setPropertyIfPresent(checklistNode, "vso:inspectionId", inspectionIdentifier);
  setPropertyIfPresent(checklistNode, "vso:locationId", contextValues.locationId);
  setPropertyIfPresent(checklistNode, "vso:locationCode", contextValues.locationCode);
  setPropertyIfPresent(checklistNode, "vso:locationName", contextValues.locationName);
  setPropertyIfPresent(checklistNode, "vso:specialtyId", contextValues.specialtyId);
  setPropertyIfPresent(checklistNode, "vso:specialtyCode", contextValues.specialtyCode);
  setPropertyIfPresent(checklistNode, "vso:specialtyName", contextValues.specialtyName);
  setPropertyIfPresent(checklistNode, "vso:activityTypeId", contextValues.activityTypeId);
  setPropertyIfPresent(checklistNode, "vso:activityTypeCode", contextValues.activityTypeCode);
  setPropertyIfPresent(checklistNode, "vso:activityTypeName", contextValues.activityTypeName);
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
    USOAP_TAG_HELPERS.applyChainDerivedUsoapTags(evidenceNode, itemPayload.reference && itemPayload.reference.usoapPqReference);
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
    setPropertyIfPresent(itemNode, "vso:regulationItem", itemPayload.reference.regulationItem);
    USOAP_TAG_HELPERS.applyChainDerivedUsoapTags(itemNode, itemPayload.reference.usoapPqReference);
  }

  itemNode.save();

  summary[itemResult.created ? "created" : "updated"]++;

  return itemNode;
}

function upsertFinding(inspectionFolder, checklistData, findingPayload, findingItemCode, relatedItemPayload, summary) {
  var findingName = findingPayload.findingId + ".json";
  var findingResult = ensureCanonicalDocumentNode(inspectionFolder, findingName, "vso:finding", "cm:contains");
  var findingNode = findingResult.node;

  ensureVersionable(findingNode);
  ensureAspect(findingNode, "vso:regulatoryTraceability");
  ensureAspect(findingNode, "vso:inspectionContext");
  ensureAspect(findingNode, "vso:serviceContext");

  var findingContextValues = resolveContextValues(findingPayload, null);
  var checklistContextValues = resolveContextValues(checklistData, null);
  var inspectionIdentifier = resolveInspectionIdentifier(checklistData, null);

  setPropertyIfPresent(findingNode, "cm:title", findingPayload.findingId);
  setPropertyIfPresent(findingNode, "vso:contentType", "finding");
  setPropertyIfPresent(findingNode, "vso:findingId", findingPayload.findingId);
  setPropertyIfPresent(findingNode, "vso:findingLevel", normalizeFindingLevel(findingPayload.findingLevel));
  setPropertyIfPresent(findingNode, "vso:findingSeverity", findingPayload.findingSeverity);
  setPropertyIfPresent(findingNode, "vso:riskClassification", findingPayload.riskClassification || findingPayload.riskLevel);
  setPropertyIfPresent(findingNode, "vso:targetResidualRisk", findingPayload.targetResidualRisk);
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
  setPropertyIfPresent(findingNode, "vso:activityTypeId", findingContextValues.activityTypeId || checklistContextValues.activityTypeId);
  setPropertyIfPresent(findingNode, "vso:activityTypeCode", findingContextValues.activityTypeCode || checklistContextValues.activityTypeCode);
  setPropertyIfPresent(findingNode, "vso:activityTypeName", findingContextValues.activityTypeName || checklistContextValues.activityTypeName);
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
  setPropertyIfPresent(
    findingNode,
    "vso:regulationItem",
    firstNonEmpty(findingPayload.regulationItem, relatedItemPayload && relatedItemPayload.reference ? relatedItemPayload.reference.regulationItem : null)
  );
  USOAP_TAG_HELPERS.applyChainDerivedUsoapTags(
    findingNode,
    (findingPayload.usoapPqReference && findingPayload.usoapPqReference.length)
      ? findingPayload.usoapPqReference
      : (relatedItemPayload && relatedItemPayload.reference ? relatedItemPayload.reference.usoapPqReference : null)
  );

  if (findingResult.created) {
    // A finding formulated directly by the inspector during field capture
    // still needs a separate reviewer's sign-off (PATCH
    // /findings/:findingId/review in compliance_web) before it's
    // considered final. Only set on creation — re-importing an existing
    // finding must not reset an already-reviewed one back to pending.
    findingNode.properties["vso:findingReviewStatus"] = "Pending Review";
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

    var checklistItemsForPdf = [];
    for (var pdfItemIndex = 0; pdfItemIndex < checklistItems.length; pdfItemIndex++) {
      var sourceItemForPdf = checklistItems[pdfItemIndex];
      var mergedItemForPdf = {};
      for (var itemKeyForPdf in sourceItemForPdf) {
        if (sourceItemForPdf.hasOwnProperty(itemKeyForPdf)) {
          mergedItemForPdf[itemKeyForPdf] = sourceItemForPdf[itemKeyForPdf];
        }
      }
      // Evidence may arrive under either key; upsertEvidence() accepts both, so the PDF must too.
      mergedItemForPdf.evidenceItems = sourceItemForPdf.evidenceItems !== undefined ? sourceItemForPdf.evidenceItems : sourceItemForPdf.evidence;
      checklistItemsForPdf.push(mergedItemForPdf);
    }

    var checklistReportLocale = resolveReportLocale(importRequest);
    replaceContentWithPdf(
      checklistNode,
      destinationDomainFolder,
      CHECKLIST_PDF_TEMPLATE_PATH,
      { checklist: checklistPayload, items: checklistItemsForPdf, labels: getReportLabels("checklistReport", checklistReportLocale) },
      checklistPayload.checklistId + ".pdf",
      ["vso:inspectionContext", "vso:serviceContext"]
    );

    for (findingIndex = 0; findingIndex < matchedFindings.length; findingIndex++) {
      var findingPayload = matchedFindings[findingIndex].payload.finding;
      normalizeFindingIdentity(findingPayload, normalizedIdentityContext, findingIndex + 1);
      var findingItemCode = resolveItemCode(findingPayload || {});
      var relatedItemPayload = itemPayloadById[findingItemCode];
      var findingNode = upsertFinding(destinationFindingsYearFolder, checklistPayload, findingPayload, findingItemCode, relatedItemPayload, summary);
      var findingContextValuesForPdf = resolveContextValues(findingPayload, null);
      var checklistContextValuesForPdf = resolveContextValues(checklistPayload, null);
      replaceContentWithPdf(
        findingNode,
        destinationFindingsYearFolder,
        FINDING_PDF_TEMPLATE_PATH,
        {
          findingId: findingPayload.findingId,
          findingLevel: findingPayload.findingLevel,
          findingSeverity: findingPayload.findingSeverity,
          riskClassification: findingPayload.riskClassification || findingPayload.riskLevel,
          targetResidualRisk: findingPayload.targetResidualRisk,
          achievedResidualRisk: findingPayload.achievedResidualRisk,
          requirementBreached: findingPayload.requirementBreached,
          checklistItemCode: findingItemCode,
          description: findingPayload.description,
          findingStatus: findingPayload.findingStatus,
          dateIssued: firstNonEmpty(findingPayload.dateIssued, findingPayload.openedDate, findingPayload.dateOpened),
          submissionDeadline: findingPayload.submissionDeadline,
          findingClosureDate: findingPayload.findingClosureDate,
          resolutionDeadline: findingPayload.resolutionDeadline,
          locationName: findingContextValuesForPdf.locationName || checklistContextValuesForPdf.locationName,
          specialtyName: findingContextValuesForPdf.specialtyName || checklistContextValuesForPdf.specialtyName,
          providerName: checklistPayload.providerName,
          icaoReference: firstNonEmpty(findingPayload.icaoReference, relatedItemPayload && relatedItemPayload.reference ? relatedItemPayload.reference.icaoReference : null),
          nationalRegulation: firstNonEmpty(findingPayload.nationalRegulation, relatedItemPayload && relatedItemPayload.reference ? relatedItemPayload.reference.nationalRegulation : null),
          regulationItem: firstNonEmpty(findingPayload.regulationItem, relatedItemPayload && relatedItemPayload.reference ? relatedItemPayload.reference.regulationItem : null),
          correctiveAction: findingPayload.correctiveAction || null,
          labels: getReportLabels("findingReport", resolveReportLocale(importRequest))
        },
        findingPayload.findingId + ".pdf",
        ["vso:inspectionContext", "vso:serviceContext", "vso:regulatoryTraceability"]
      );
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