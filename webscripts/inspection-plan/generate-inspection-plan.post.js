// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

// Path configuration is centralized.
// Maintain folder paths in README.md -> "Path configuration (Alfresco)" and webscripts/common/vso-paths.lib.js.
function resolveVsoPaths() {
  var defaults = {
    inspectionInProcessPath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Inspecciones",
    canonicalSourceBasePath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Datos de campo",
    inspectionPlanTemplateDataPath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Template data",
    inspectionPlanTemplatePath: "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/formato plan de inspeccion.fodt"
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

function importTemplateGenerationLibrary() {
  if (typeof TemplateGeneration !== "undefined" && TemplateGeneration) {
    logger.info("[inspection-plan] TemplateGeneration source: preloaded");
    return;
  }

  var candidates = [
    "../common/vso-paths.lib.js",
    "classpath:alfresco/extension/templates/webscripts/common/vso-paths.lib.js",
    "classpath*:alfresco/extension/templates/webscripts/common/vso-paths.lib.js"
  ];
  var loadErrors = [];

  if (typeof importScript !== "function") {
    loadErrors.push("importScript is not available in this script runtime");
  }

  if (typeof importScript === "function") {
    for (var index = 0; index < candidates.length; index++) {
      try {
        importScript(candidates[index]);
        if (typeof TemplateGeneration !== "undefined" && TemplateGeneration) {
          logger.info("[inspection-plan] TemplateGeneration source: imported from " + candidates[index]);
          return;
        }
      } catch (error) {
        loadErrors.push(candidates[index] + " -> " + error.message);
      }
    }
  }

  logger.warn("[inspection-plan] Falling back to inline TemplateGeneration. Reasons: " + loadErrors.join(" | "));

  TemplateGeneration = {
    trimToNull: function(value) {
      if (value === null || value === undefined) {
        return null;
      }
      var normalized = String(value).replace(/^\s+|\s+$/g, "");
      return normalized.length === 0 ? null : normalized;
    },
    setError: function(code, message) {
      status.code = code;
      status.message = message;
      status.redirect = true;
      model = { error: message };
    },
    fail: function(code, message) {
      TemplateGeneration.setError(code, message);
      throw new Error(message);
    },
    parseJsonPayload: function(rawContent) {
      var payload = TemplateGeneration.trimToNull(rawContent);
      if (payload === null) {
        TemplateGeneration.fail(400, "Request body is empty");
      }
      try {
        var parsed = JSON.parse(payload);
        if (!parsed || typeof parsed !== "object") {
          TemplateGeneration.fail(400, "Invalid JSON payload structure");
        }
        return parsed;
      } catch (error) {
        TemplateGeneration.fail(400, "Invalid JSON: " + error.message);
      }
    },
    loadEntityProfile: function loadEntityProfile(locale) {
      var fallback = {
        entityName: { es: "AUTORIDAD DE AVIACIÓN CIVIL", en: "CIVIL AVIATION AUTHORITY" },
        entityLogoPath: "entity-logo.png",
        docControlCodes: {
          informeFinal: "",
          planDeInspeccion: "",
          checklistReport: "",
          findingReport: "",
          followUpReport: ""
        },
        docControlVersion: "",
        docControlDate: "",
        signatures: {
          planApprovedBy: { es: "", en: "" },
          planApprovedByPosition: { es: "", en: "" },
          reportApprovedBy: { es: "", en: "" },
          reportApprovedByPosition: { es: "", en: "" }
        },
        signatureDate: ""
      };
      var profileDir = "/usr/local/tomcat/shared/classes/alfresco/extension";

      function detectMimeType(base64) {
        if (!base64) {
          return "";
        }
        if (base64.indexOf("/9j/") === 0) {
          return "image/jpeg";
        }
        if (base64.indexOf("iVBOR") === 0) {
          return "image/png";
        }
        if (base64.indexOf("R0lGOD") === 0) {
          return "image/gif";
        }
        return "";
      }

      function resolveLocalized(value, resolvedLocale) {
        if (typeof value === "string") {
          return value;
        }
        if (!value || typeof value !== "object") {
          return "";
        }
        var order = [resolvedLocale, "es", "en"];
        for (var orderIndex = 0; orderIndex < order.length; orderIndex++) {
          if (typeof value[order[orderIndex]] === "string" && value[order[orderIndex]].length > 0) {
            return value[order[orderIndex]];
          }
        }
        for (var key in value) {
          if (value.hasOwnProperty(key) && typeof value[key] === "string") {
            return value[key];
          }
        }
        return "";
      }

      function readLogo(configuredPath) {
        var candidates = configuredPath ? [configuredPath] : [];
        candidates.push("entity-logo.png", "entity-logo.jpg", "entity-logo.jpeg");
        for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
          var candidate = candidates[candidateIndex];
          var absolutePath = candidate.charAt(0) === "/" ? candidate : profileDir + "/" + candidate;
          try {
            var logoFile = new Packages.java.io.File(absolutePath);
            if (logoFile.exists() && logoFile.isFile()) {
              var bytes = Packages.org.apache.commons.io.FileUtils.readFileToByteArray(logoFile);
              return String(Packages.java.util.Base64.getEncoder().encodeToString(bytes));
            }
          } catch (logoError) {
          }
        }
        return "";
      }

      var resolvedLocale = (locale === "en") ? "en" : "es";
      var parsed = null;
      try {
        var file = new Packages.java.io.File(profileDir + "/entity-profile.json");
        if (file.exists()) {
          parsed = JSON.parse(String(Packages.org.apache.commons.io.FileUtils.readFileToString(file, "UTF-8")));
        }
      } catch (loadError) {
        parsed = null;
      }
      var source = parsed || {};
      var codes = source.docControlCodes || fallback.docControlCodes;
      var signatureSource = source.signatures || fallback.signatures;
      var logoBase64 = (typeof source.entityLogoBase64 === "string" && source.entityLogoBase64.length > 0)
        ? source.entityLogoBase64
        : readLogo(typeof source.entityLogoPath === "string" ? source.entityLogoPath : fallback.entityLogoPath);
      var mimeType = (typeof source.entityLogoMimeType === "string" && source.entityLogoMimeType.length > 0)
        ? source.entityLogoMimeType
        : detectMimeType(logoBase64);
      return {
        entityName: resolveLocalized(source.entityName || fallback.entityName, resolvedLocale),
        entityLogoBase64: logoBase64,
        entityLogoMimeType: mimeType || "image/jpeg",
        docControlCodes: {
          informeFinal: codes.informeFinal || "",
          planDeInspeccion: codes.planDeInspeccion || "",
          checklistReport: codes.checklistReport || "",
          findingReport: codes.findingReport || "",
          followUpReport: codes.followUpReport || ""
        },
        docControlVersion: (typeof source.docControlVersion === "string") ? source.docControlVersion : "",
        docControlDate: (typeof source.docControlDate === "string") ? source.docControlDate : "",
        signatures: {
          planApprovedBy: resolveLocalized(signatureSource.planApprovedBy, resolvedLocale),
          planApprovedByPosition: resolveLocalized(signatureSource.planApprovedByPosition, resolvedLocale),
          reportApprovedBy: resolveLocalized(signatureSource.reportApprovedBy, resolvedLocale),
          reportApprovedByPosition: resolveLocalized(signatureSource.reportApprovedByPosition, resolvedLocale)
        },
        signatureDate: (typeof source.signatureDate === "string") ? source.signatureDate : ""
      };
    },
    xmlEscapeDeep: function xmlEscapeDeep(value) {
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
    },
    renderTemplateContent: function(templateNode, data) {
      function resolvePath(context, path) {
        var parts = String(path).split(".");
        var current = context;
        for (var index = 0; index < parts.length; index++) {
          if (!current || typeof current !== "object" || !(parts[index] in current)) {
            return "";
          }
          current = current[parts[index]];
        }
        return current === null || current === undefined ? "" : current;
      }

      function replaceVariables(block, context) {
        return block.replace(/\$\{\s*([^}]+?)\s*\}/g, function(_, expr) {
          return String(resolvePath(context, expr));
        });
      }

      function findMatchingListClose(block, searchStart) {
        var depth = 1;
        var cursor = searchStart;

        while (cursor < block.length) {
          var nextOpen = block.indexOf("[#list", cursor);
          var nextClose = block.indexOf("[/#list]", cursor);

          if (nextClose === -1) {
            return -1;
          }

          if (nextOpen !== -1 && nextOpen < nextClose) {
            var nestedOpenEnd = block.indexOf("]", nextOpen);
            if (nestedOpenEnd === -1) {
              return -1;
            }
            depth += 1;
            cursor = nestedOpenEnd + 1;
            continue;
          }

          depth -= 1;
          if (depth === 0) {
            return nextClose;
          }
          cursor = nextClose + 8;
        }

        return -1;
      }

      function renderBlock(block, context) {
        var openStart = block.indexOf("[#list");
        if (openStart === -1) {
          return replaceVariables(block, context);
        }

        var openEnd = block.indexOf("]", openStart);
        if (openEnd === -1) {
          return replaceVariables(block, context);
        }

        var openTag = block.slice(openStart, openEnd + 1);
        var openMatch = /^\[#list\s+([^\s\]]+)\s+as\s+([^\s\]]+)\s*\]$/.exec(openTag);
        if (!openMatch) {
          return replaceVariables(block, context);
        }

        var closeStart = findMatchingListClose(block, openEnd + 1);
        if (closeStart === -1) {
          return replaceVariables(block, context);
        }

        var before = block.slice(0, openStart);
        var inner = block.slice(openEnd + 1, closeStart);
        var after = block.slice(closeStart + 8);
        var collection = resolvePath(context, openMatch[1]);
        var renderedList = "";

        if (Array.isArray(collection)) {
          for (var itemIndex = 0; itemIndex < collection.length; itemIndex++) {
            var scoped = Object.create(context || {});
            scoped[openMatch[2]] = collection[itemIndex];
            renderedList += renderBlock(inner, scoped);
          }
        }

        return renderBlock(before, context) + renderedList + renderBlock(after, context);
      }

      return renderBlock(String(templateNode.content), data);
    },
    upsertDocument: function(options) {
      var existingNode = options.destinationFolder.childByNamePath(options.fileName);
      var outputNode;
      var isNewVersion = false;

      function ensureAspect(node, aspectName) {
        if (!node.hasAspect(aspectName)) {
          node.addAspect(aspectName);
        }
      }

      if (existingNode) {
        ensureAspect(existingNode, "cm:versionable");
        var workingCopy = existingNode.checkout();
        workingCopy.content = options.content;
        if (options.mimetype) {
          workingCopy.mimetype = options.mimetype;
        }
        outputNode = workingCopy.checkin(options.versionComment || "Update content via script", false);
        isNewVersion = true;
      } else {
        outputNode = options.destinationFolder.createNode(options.fileName, options.nodeType || "vso:vsoContent");
        if (!outputNode) {
          TemplateGeneration.fail(500, "Failed to create output file");
        }
        outputNode.content = options.content;
        if (options.mimetype) {
          outputNode.mimetype = options.mimetype;
        }
      }

      if (options.aspects) {
        for (var aspectIndex = 0; aspectIndex < options.aspects.length; aspectIndex++) {
          ensureAspect(outputNode, options.aspects[aspectIndex]);
        }
      }

      if (options.properties) {
        for (var propertyName in options.properties) {
          if (options.properties.hasOwnProperty(propertyName)) {
            var propertyValue = options.properties[propertyName];
            if (propertyValue !== null && propertyValue !== undefined) {
              outputNode.properties[propertyName] = propertyValue;
            }
          }
        }
      }

      outputNode.save();
      return { node: outputNode, isNewVersion: isNewVersion };
    }
  };
}

var VSO_PATHS = resolveVsoPaths();
var TEMPLATE_PATH = VSO_PATHS.inspectionPlanTemplatePath || "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/formato plan de inspeccion.fodt";
var INSPECTIONS_PATH = VSO_PATHS.inspectionInProcessPath || "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Inspecciones";
var FILE_PREFIX = "Plan de inspeccion - ";
var FILE_EXTENSION = ".fodt";
var MIMETYPE = "application/vnd.oasis.opendocument.text";

// Locale-keyed static header labels for formato plan de inspeccion.fodt.
// Keys correspond to ${labels.<key>} placeholders in the template.
var PLAN_LABELS = {
  en: {
    formHeading: "FORM",
    codeLabel: "Code",
    versionLabel: "Version",
    docTitle: "INSPECTION PLAN",
    docSubtitle: "OPERATIONAL SAFETY OVERSIGHT",
    inspectionNoLabel: "Inspection No.: ",
    entitiesToInspectLabel: "Entity(ies) to be Inspected:",
    objectivesLabel: "Objectives: ",
    scopeLabel: "Scope: ",
    referenceDocsUsageLabel: "Use of Reference Documents for the Inspection",
    teamMembersLabel: "Team Members",
    mainSpecialistLabel: "Lead Specialist: ",
    alternateSpecialistLabel: "Alternate Specialist: ",
    proposedInspectionDateLabel: "Proposed inspection date: ",
    proposedOpeningMeetingLabel: "Proposed opening meeting: ",
    proposedClosingMeetingLabel: "Proposed closing meeting: ",
    interviewScheduleLabel: "Interview Schedule:",
    finalReportDistributionListLabel: "Final Report Distribution List:",
    finalReportDeliveryDateLabel: "Final Report Delivery Date:",
    preparedByLabel: "Prepared by: ",
    approvedByLabel: "Approved by:",
    positionLabel: "Position:",
    leadSpecialistPositionText: "Lead Specialist, operational safety inspection team, inspection ",
    dateLabel: "Date: ",
    signatureLabel: "Signature:"
  },
  es: {
    formHeading: "FORMULARIO",
    codeLabel: "Código",
    versionLabel: "Versión",
    docTitle: "PLAN DE INSPECCIÓN",
    docSubtitle: "VIGILANCIA DE LA SEGURIDAD OPERACIONAL",
    inspectionNoLabel: "Inspección No.: ",
    entitiesToInspectLabel: "Entidad(es) a Inspeccionar:",
    objectivesLabel: "Objetivos: ",
    scopeLabel: "Alcance: ",
    referenceDocsUsageLabel: "Uso de documentos de referencia para la inspección",
    teamMembersLabel: "Miembros del equipo",
    mainSpecialistLabel: "Especialista Principal: ",
    alternateSpecialistLabel: "Especialista Alterno: ",
    proposedInspectionDateLabel: "Fecha propuesta de inspección: ",
    proposedOpeningMeetingLabel: "Reunión propuesta de inicio: ",
    proposedClosingMeetingLabel: "Reunión propuesta de clausura: ",
    interviewScheduleLabel: "Cronograma de entrevistas:",
    finalReportDistributionListLabel: "Lista de distribución del informe final:",
    finalReportDeliveryDateLabel: "Fecha de entrega del informe final:",
    preparedByLabel: "Elaborado por: ",
    approvedByLabel: "Aprobado por:",
    positionLabel: "Cargo:",
    leadSpecialistPositionText: "Especialista principal, equipo de inspección de la seguridad operacional, inspección ",
    dateLabel: "Fecha: ",
    signatureLabel: "Firma:"
  }
};

importTemplateGenerationLibrary();

function setPropertyIfPresent(node, propertyName, value) {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value === "string") {
    // Only strings are trimmed. Coercing a Date/typed value to a String here made
    // Alfresco reject it: a JS Date becomes "Wed Mar 26 2025 00:00:00 GMT-0000 (UTC)"
    // and properties like vso:startDate are declared as dates.
    var normalized = value.replace(/^\s+|\s+$/g, "");
    if (normalized.length === 0) {
      return;
    }
    node.properties[propertyName] = normalized;
    return;
  }
  node.properties[propertyName] = value;
}

function ensureAspect(node, aspectName) {
  if (!node.hasAspect(aspectName)) {
    node.addAspect(aspectName);
  }
}

function describeError(error) {
  if (!error) {
    return "Unknown error";
  }

  var parts = [];

  if (error.message) {
    parts.push(String(error.message));
  } else {
    parts.push(String(error));
  }

  if (error.javaException) {
    parts.push(String(error.javaException));
  }

  return parts.join(" | ");
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

  TemplateGeneration.fail(403, "Access denied: " + operation +
    " requires an Alfresco administrator or a member of a configured mutation group.");
}

// Node names come from caller-supplied identifiers and are concatenated into
// repository paths. Reject anything that could escape the intended folder.
function assertSafeNodeName(value, fieldName) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value) || value.indexOf("..") !== -1) {
    TemplateGeneration.fail(400, "Invalid " + fieldName + ": expected a plain identifier without path separators");
  }
  return value;
}

function ensureInspectionFolder(baseFolder, inspectionId) {
  var folder = baseFolder.childByNamePath(inspectionId);
  if (folder && folder.exists()) {
    if (!folder.isContainer) {
      TemplateGeneration.fail(409, "Destination inspection already exists and is not a folder: " + inspectionId);
    }
    if (!folder.isSubType("vso:inspection")) {
      try {
        folder.specializeType("vso:inspection");
      } catch (specializeExistingError) {
        TemplateGeneration.fail(500, "Existing inspection folder could not be specialized to vso:inspection for " + inspectionId + ": " + describeError(specializeExistingError));
      }
    }
    return folder;
  }

  try {
    return baseFolder.createFolder(inspectionId, "vso:inspection");
  } catch (typedCreateError) {
    logger.warn("[inspection-plan] Typed folder creation failed for " + inspectionId + ". Retrying with cm:folder and specializeType. Cause: " + describeError(typedCreateError));
  }

  try {
    folder = baseFolder.createFolder(inspectionId);
  } catch (plainCreateError) {
    TemplateGeneration.fail(500, "Failed to create inspection folder " + inspectionId + ": " + describeError(plainCreateError));
  }

  try {
    if (!folder.isSubType("vso:inspection")) {
      folder.specializeType("vso:inspection");
    }
  } catch (specializeNewError) {
    TemplateGeneration.fail(500, "Inspection folder was created but could not be specialized to vso:inspection for " + inspectionId + ": " + describeError(specializeNewError));
  }

  return folder;
}

function populateInspectionFolderData(folder, inputData) {
  if (!folder.isSubType("vso:inspection")) {
    try {
      folder.specializeType("vso:inspection");
    } catch (specializeError) {
      TemplateGeneration.fail(500, "Failed to specialize inspection folder " + folder.name + " to vso:inspection: " + describeError(specializeError));
    }
  }

  try {
    ensureAspect(folder, "vso:inspectionContext");
    ensureAspect(folder, "vso:serviceContext");
  } catch (aspectError) {
    TemplateGeneration.fail(500, "Failed to apply inspection aspects to folder " + folder.name + ": " + describeError(aspectError));
  }

  var inspectionId = TemplateGeneration.trimToNull(inputData.inspectionNo) || TemplateGeneration.trimToNull(inputData.inspectionCode);
  setPropertyIfPresent(folder, "cm:title", TemplateGeneration.trimToNull(inputData.title) || inspectionId || folder.name);
  setPropertyIfPresent(folder, "vso:inspectionId", inspectionId);
  setPropertyIfPresent(folder, "vso:inspectionType", inputData.inspectionType);
  setPropertyIfPresent(folder, "vso:startDate", inputData.startDate);
  setPropertyIfPresent(folder, "vso:endDate", inputData.endDate);
  setPropertyIfPresent(folder, "vso:locationId", inputData.locationId);
  setPropertyIfPresent(folder, "vso:locationName", inputData.locationName);
  setPropertyIfPresent(folder, "vso:providerId", inputData.providerId);
  setPropertyIfPresent(folder, "vso:providerName", inputData.providerName);
  setPropertyIfPresent(folder, "vso:inspectionStatus", inputData.inspectionStatus || "Planned");

  try {
    folder.save();
  } catch (saveError) {
    TemplateGeneration.fail(500, "Failed to save inspection folder metadata for " + folder.name + ": " + describeError(saveError));
  }
}

// Renders a generated plan into a PDF inside its inspection folder, checking in a new version
// when the PDF is already there.
//
// The render's transient .fodt source is created *inside the inspection folder*, not in the
// "Template data" folder. Template data carries a Share rule that transforms anything written
// to it (.fodt -> .odt -> .pdf); writing the same .fodt there on a second generation made the
// rule's .odt output collide with the first run's leftover ("Duplicate child name not allowed:
// ... .odt"), and the rule's own PDF update rewrote content without creating a version. Rendering
// here sidesteps that rule entirely and makes regeneration a versioned update, so a plan that was
// adjusted can be generated again. The inspection folder has no such rule.
//
// One PDF per inspection: the first generation creates it, every later one checks in a new
// version of the same node.
// The transform framework creates a temporary sibling node for the source
// (".<name>.render.bin") and leaks it when the transform fails — re-creating it then
// collides. Remove anything left under the render prefix before (and after) rendering.
function removeRenderScratchNodes(folder, scratchPrefix) {
  var children = folder.children || [];
  for (var index = 0; index < children.length; index++) {
    var child = children[index];
    if (child && String(child.name).indexOf(scratchPrefix) === 0) {
      try { child.remove(); } catch (cleanupError) { /* best effort */ }
    }
  }
}

function fileRenderedDocumentPdf(renderedContent, inspectionFolder, pdfName, properties, versionComment) {
  if (!inspectionFolder || !inspectionFolder.exists() || !inspectionFolder.isContainer) {
    TemplateGeneration.fail(500, "Inspection folder not found for the generated plan");
  }

  var scratchPrefix = "." + String(pdfName).replace(/\.pdf$/i, "") + ".render";
  var scratchName = scratchPrefix + ".fodt";
  removeRenderScratchNodes(inspectionFolder, scratchPrefix);
  var scratchNode = inspectionFolder.createNode(scratchName, "cm:content");
  if (!scratchNode) {
    TemplateGeneration.fail(500, "Could not create the plan render document");
  }

  var transformedPdf = null;
  try {
    scratchNode.content = renderedContent;
    scratchNode.mimetype = MIMETYPE;
    scratchNode.save();
    transformedPdf = scratchNode.transformDocument("application/pdf");
  } catch (renderError) {
    removeRenderScratchNodes(inspectionFolder, scratchPrefix);
    TemplateGeneration.fail(500, "Plan PDF transformation failed: " + describeError(renderError));
  }

  if (!transformedPdf || !transformedPdf.exists()) {
    removeRenderScratchNodes(inspectionFolder, scratchPrefix);
    TemplateGeneration.fail(500, "PDF transformation failed for document: " + pdfName);
  }

  var existingPdf = inspectionFolder.childByNamePath(pdfName);
  var pdfNode = null;
  var isNewVersion = false;

  if (existingPdf && existingPdf.isDocument) {
    ensureAspect(existingPdf, "cm:versionable");
    // A generation that failed mid-flight can leave a working copy behind, and checkout()
    // cannot start a second one for the same node.
    var staleWorkingCopy = inspectionFolder.childByNamePath(String(existingPdf.name) + " (Working Copy)");
    if (staleWorkingCopy) {
      logger.warn("[inspection-plan] Removing stale working copy before regenerating " + pdfName);
      staleWorkingCopy.remove();
    }
    var workingCopy = existingPdf.checkout();
    workingCopy.properties["content"].write(transformedPdf.properties["content"]);
    workingCopy.mimetype = "application/pdf";
    pdfNode = workingCopy.checkin(versionComment, false);
    isNewVersion = true;
  } else {
    var copied = transformedPdf.copy(inspectionFolder);
    // transformDocument names its output after the source, so the scratch
    // ".<name>.render.fodt" transforms to ".<name>.render.pdf". Rename the filed copy
    // to the document's real name; otherwise the next run cannot find it and adds
    // another "Copy of ..." instead of a version.
    if (copied && String(copied.name) !== pdfName) {
      copied.name = pdfName;
    }
    pdfNode = copied || inspectionFolder.childByNamePath(pdfName) || null;
    if (pdfNode) {
      ensureAspect(pdfNode, "cm:versionable");
    }
  }

  if (pdfNode && properties) {
    for (var propertyName in properties) {
      if (properties.hasOwnProperty(propertyName)) {
        setPropertyIfPresent(pdfNode, propertyName, properties[propertyName]);
      }
    }
    pdfNode.save();
  }

  transformedPdf.remove();
  removeRenderScratchNodes(inspectionFolder, scratchPrefix);

  if (!pdfNode || !pdfNode.exists()) {
    TemplateGeneration.fail(500, "The generated plan PDF was not filed in " + inspectionFolder.name);
  }

  return { node: pdfNode, isNewVersion: isNewVersion };
}

try {
  requireMutationAccess("generating an inspection plan");
  var inputData = TemplateGeneration.parseJsonPayload(requestbody.content);
  var inspectionNo = TemplateGeneration.trimToNull(inputData.inspectionNo);

  if (inspectionNo === null) {
    TemplateGeneration.fail(400, "Missing required field: inspectionNo");
  }
  assertSafeNodeName(inspectionNo, "inspectionNo");

  // Repository paths are resolved from vso-paths.lib.js only (see the report
  // webscript): request-supplied paths are ignored.
  var templatePath = TEMPLATE_PATH;
  var inspectionsPath = INSPECTIONS_PATH;

  var templateNode = companyhome.childByNamePath(templatePath);
  if (!templateNode || !templateNode.exists()) {
    logger.error("Template not found at path: " + templatePath);
    TemplateGeneration.fail(500, "Template not found in repository");
  }

  var inspectionsFolder = companyhome.childByNamePath(inspectionsPath);
  if (!inspectionsFolder || !inspectionsFolder.exists()) {
    logger.error("Inspections folder not found at path: " + inspectionsPath);
    TemplateGeneration.fail(500, "Inspections folder not found");
  }

  var inspectionFolder = ensureInspectionFolder(inspectionsFolder, inspectionNo);
  populateInspectionFolderData(inspectionFolder, inputData);

  var planLocale = (TemplateGeneration.trimToNull(inputData.locale) === "en") ? "en" : "es";
  var planEntityProfile = TemplateGeneration.loadEntityProfile(planLocale);
  inputData.entityName = planEntityProfile.entityName;
  inputData.entityLogoBase64 = planEntityProfile.entityLogoBase64;
  inputData.entityLogoMimeType = planEntityProfile.entityLogoMimeType;
  inputData.docControlCode = planEntityProfile.docControlCodes.planDeInspeccion;
  inputData.docControlVersion = planEntityProfile.docControlVersion;
  inputData.docControlDate = planEntityProfile.docControlDate;
  // Signature block: the caller may supply an approver per inspection (the flow
  // defaults it to the planner who defined the site visit); the deployment profile
  // is the fallback. Anything still unset renders blank.
  inputData.planApprovedBy =
    TemplateGeneration.trimToNull(inputData.approvedBy) || planEntityProfile.signatures.planApprovedBy || "";
  inputData.planApprovedByPosition =
    TemplateGeneration.trimToNull(inputData.approvedByPosition) || planEntityProfile.signatures.planApprovedByPosition || "";
  inputData.signatureDate =
    TemplateGeneration.trimToNull(inputData.signatureDate) || planEntityProfile.signatureDate || new Date().toISOString().slice(0, 10);
  inputData.labels = PLAN_LABELS[planLocale];
  // The template iterates "[#list providers as provider]" (plural), but callers
  // only ever send a single "provider" object (this endpoint is scoped to one
  // provider per site-visit inspection) — alias it into a one-element array so
  // the Entity(ies)-to-be-Inspected/Team Members sections actually render.
  inputData.providers = inputData.provider ? [inputData.provider] : [];
  var templateRenderData = TemplateGeneration.xmlEscapeDeep(inputData);

  var generatedContent = TemplateGeneration.renderTemplateContent(templateNode, templateRenderData);
  var outputName = FILE_PREFIX + inspectionNo + FILE_EXTENSION;
  var pdfName = outputName.replace(/\.fodt$/, ".pdf");

  var result = fileRenderedDocumentPdf(
    generatedContent,
    inspectionFolder,
    pdfName,
    {
      "cm:title": inputData.title || "Generated Inspection Plan",
      "cm:description": "Auto-generated on " + new Date().toISOString(),
      "vso:inspectionId": inspectionNo,
      "vso:startDate": inputData.startDate,
      "vso:endDate": inputData.endDate,
      "vso:locationId": inputData.locationId,
      "vso:locationName": inputData.locationName,
      "vso:inspectionStatus": "Planned"
    },
    "Update inspection plan via script"
  );

  var pdfNode = result.node;
  status.code = result.isNewVersion ? 200 : 201;

  // `displayPath` is the parent path (Alfresco's ScriptNode convention — see the same
  // `displayPath + "/" + name` in scripts/transformInspectionPlan.js), so the folder's own
  // name has to be appended.
  var pdfFolderPath = inspectionFolder.displayPath + "/" + inspectionFolder.name;

  model.success = true;
  model.result = {
    name: pdfName,
    path: pdfFolderPath + "/" + pdfName,
    inspectionFolder: pdfFolderPath,
    version: pdfNode.properties["cm:versionLabel"],
    downloadUrl: pdfNode.downloadUrl,
    nodeRef: pdfNode.nodeRef.toString(),
    sourceName: outputName,
    isNewVersion: result.isNewVersion
  };

  logger.info(
    (result.isNewVersion ? "New minor version created for: " : "Successfully created document: ") +
      outputName +
      " (plan filed as " + pdfName + ")"
  );
} catch (error) {
  logger.error("Unexpected error in document generation: " + error.message);
  if (!model || !model.error) {
    TemplateGeneration.setError(500, "Internal server error: " + error.message);
  }
}
