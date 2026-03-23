// Path configuration is centralized.
// Maintain folder paths in README.md -> "Path configuration (Alfresco)" and webscripts/common/vso-paths.lib.js.
function resolveVsoPaths() {
  var defaults = {
    inspectionInProcessPath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Inspecciones",
    canonicalSourceBasePath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Datos de campo",
    inspectionReportTemplateDataPath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Template data",
    inspectionReportTemplatePath: "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/Informe Final.fodt"
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
    logger.error("[inspection-report] TemplateGeneration source: preloaded");
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
          logger.error("[inspection-report] TemplateGeneration source: imported from " + candidates[index]);
          return;
        }
      } catch (error) {
        loadErrors.push(candidates[index] + " -> " + error.message);
      }
    }
  }

  logger.warn("[inspection-report] Falling back to inline TemplateGeneration. Reasons: " + loadErrors.join(" | "));

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

function firstNonEmpty() {
  for (var index = 0; index < arguments.length; index++) {
    var value = TemplateGeneration.trimToNull(arguments[index]);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeInspectors(inputData) {
  var sourceInspectors = toArray(inputData.inspectors);
  if (sourceInspectors.length === 0 && inputData.checklist && Array.isArray(inputData.checklist.inspectors)) {
    sourceInspectors = inputData.checklist.inspectors;
  }

  var result = [];
  for (var index = 0; index < sourceInspectors.length; index++) {
    var inspector = sourceInspectors[index] || {};
    result.push({
      name: firstNonEmpty(inspector.name, inspector.inspectorName) || "",
      specialty: firstNonEmpty(inspector.specialty, inspector.domain, inspector.area) || ""
    });
  }

  return result;
}

function normalizeFindings(inputData) {
  var findings = toArray(inputData.findings);
  if (findings.length > 0) {
    return findings;
  }

  var checklistItems = [];
  if (inputData.checklist && Array.isArray(inputData.checklist.items)) {
    checklistItems = inputData.checklist.items;
  }

  var derivedFindings = [];
  for (var index = 0; index < checklistItems.length; index++) {
    var item = checklistItems[index] || {};
    var status = String(item.complianceStatus || "").toLowerCase();
    var isNonCompliant =
      status === "non-compliant" ||
      status === "non compliant" ||
      status === "non-compliance";

    if (!isNonCompliant) {
      continue;
    }

    derivedFindings.push({
      itemCode: firstNonEmpty(item.itemCode, item.code) || "",
      domain: firstNonEmpty(item.domain, item.specialty) || "",
      description: firstNonEmpty(item.comment, item.description) || "",
      nationalRegulation: firstNonEmpty(item.nationalRegulation, item.regulation) || ""
    });
  }

  return derivedFindings;
}

function sanitizeFileNameToken(value) {
  return String(value).replace(/[\\\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function buildDateRange(inputData) {
  var dateRange = firstNonEmpty(inputData.dateRange, inputData.checklist ? inputData.checklist.dateRange : null);
  if (dateRange !== null) {
    return dateRange;
  }

  var startDate = firstNonEmpty(inputData.startDate, inputData.checklist ? inputData.checklist.startDate : null);
  var endDate = firstNonEmpty(inputData.endDate, inputData.checklist ? inputData.checklist.endDate : null);

  if (startDate !== null && endDate !== null) {
    return startDate + " al " + endDate;
  }

  return startDate || endDate || "";
}

function buildReportContext(inputData) {
  var context = {};
  for (var key in inputData) {
    if (inputData.hasOwnProperty(key)) {
      context[key] = inputData[key];
    }
  }

  var inspectionCode = firstNonEmpty(inputData.inspectionCode, inputData.inspectionNo, inputData.checklist ? inputData.checklist.inspectionCode : null);
  var locationName = firstNonEmpty(inputData.locationName, inputData.checklist ? inputData.checklist.locationName : null);
  var providerName = firstNonEmpty(
    inputData.providerName,
    inputData.serviceProviderName,
    inputData.checklist ? inputData.checklist.providerName : null,
    inputData.checklist ? inputData.checklist.serviceProviderName : null
  );

  var inspectors = normalizeInspectors(inputData);
  var findings = normalizeFindings(inputData);

  context.inspectionCode = inspectionCode || "";
  context.locationName = locationName || "";
  context.providerName = providerName || "";
  context.dateRange = buildDateRange(inputData);
  context.reportDate = firstNonEmpty(inputData.reportDate) || new Date().toISOString().slice(0, 10);
  context.inspectors = inspectors;
  context.mainInspector = firstNonEmpty(inputData.mainInspector, inspectors.length > 0 ? inspectors[0].name : null) || "";
  context.findings = findings;

  return context;
}

var VSO_PATHS = resolveVsoPaths();
var TEMPLATE_PATH = VSO_PATHS.inspectionReportTemplatePath || "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/Informe Final.fodt";
var DESTINATION_PATH = VSO_PATHS.inspectionReportTemplateDataPath || "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Template data";
var FILE_PREFIX = "Informe de inspeccion - ";
var FILE_EXTENSION = ".fodt";
var MIMETYPE = "application/vnd.oasis.opendocument.text";

importTemplateGenerationLibrary();

try {
  var inputData = TemplateGeneration.parseJsonPayload(requestbody.content);
  var reportData = buildReportContext(inputData);
  var inspectionCode = TemplateGeneration.trimToNull(reportData.inspectionCode);

  if (inspectionCode === null) {
    TemplateGeneration.fail(400, "Missing required field: inspectionCode (or inspectionNo/checklist.inspectionCode)");
  }

  var templatePath = TemplateGeneration.trimToNull(inputData.templatePath) || TEMPLATE_PATH;
  var destinationPath = TemplateGeneration.trimToNull(inputData.destinationPath) || DESTINATION_PATH;

  var templateNode = companyhome.childByNamePath(templatePath);
  if (!templateNode || !templateNode.exists()) {
    logger.error("Template not found at path: " + templatePath);
    TemplateGeneration.fail(500, "Template not found in repository");
  }

  var destinationFolder = companyhome.childByNamePath(destinationPath);
  if (!destinationFolder || !destinationFolder.exists()) {
    logger.error("Destination folder not found at path: " + destinationPath);
    TemplateGeneration.fail(500, "Destination folder not found");
  }

  var generatedContent = TemplateGeneration.renderTemplateContent(templateNode, reportData);
  var providerSuffix = TemplateGeneration.trimToNull(reportData.providerName);
  var outputName =
    FILE_PREFIX +
    inspectionCode +
    (providerSuffix ? " - " + sanitizeFileNameToken(providerSuffix) : "") +
    FILE_EXTENSION;

  var result = TemplateGeneration.upsertDocument({
    destinationFolder: destinationFolder,
    fileName: outputName,
    nodeType: "vso:vsoContent",
    content: generatedContent,
    mimetype: MIMETYPE,
    aspects: ["cm:versionable", "vso:inspectionContext"],
    versionComment: "Update inspection report via script",
    properties: {
      "cm:title": inputData.title || "Generated Inspection Report",
      "cm:description": "Auto-generated on " + new Date().toISOString(),
      "vso:inspectionId": inspectionCode,
      "vso:startDate": firstNonEmpty(inputData.startDate, inputData.checklist ? inputData.checklist.startDate : null),
      "vso:endDate": firstNonEmpty(inputData.endDate, inputData.checklist ? inputData.checklist.endDate : null),
      "vso:locationId": firstNonEmpty(inputData.locationId, inputData.checklist ? inputData.checklist.locationId : null),
      "vso:locationName": reportData.locationName,
      "vso:inspectionStatus": "Reported"
    }
  });

  var outputFile = result.node;
  status.code = result.isNewVersion ? 200 : 201;
  model.success = true;
  model.result = {
    nodeRef: outputFile.nodeRef.toString(),
    name: outputFile.name,
    url: outputFile.url,
    downloadUrl: outputFile.downloadUrl,
    path: destinationFolder.displayPath + "/" + outputFile.name,
    createdDate: outputFile.properties["cm:created"],
    version: outputFile.properties["cm:versionLabel"],
    isNewVersion: result.isNewVersion
  };

  logger.error((result.isNewVersion ? "New minor version created for: " : "Successfully created document: ") + outputFile.name);
} catch (error) {
  logger.error("Unexpected error in inspection report generation: " + error.message);
  if (!model || !model.error) {
    TemplateGeneration.setError(500, "Internal server error: " + error.message);
  }
}
