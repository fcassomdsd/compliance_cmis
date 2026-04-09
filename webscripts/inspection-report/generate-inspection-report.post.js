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
    logger.info("[inspection-report] TemplateGeneration source: preloaded");
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
          logger.info("[inspection-report] TemplateGeneration source: imported from " + candidates[index]);
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

function trimProp(node, propName) {
  var val = node.properties[propName];
  if (val === null || val === undefined) {
    return "";
  }
  return String(val).replace(/^\s+|\s+$/g, "");
}

function buildChecklistSummaryTable(checklistData) {
  var summaryMap = {};

  for (var index = 0; index < checklistData.length; index++) {
    var item = checklistData[index];
    var specialtyName = item.specialtyName || "Unknown";
    var complianceStatus = item.complianceStatus || "Unknown";
    var key = specialtyName + "||" + complianceStatus;

    if (!summaryMap[key]) {
      summaryMap[key] = {
        specialtyName: specialtyName,
        complianceStatus: complianceStatus,
        count: 0
      };
    }

    summaryMap[key].count += 1;
  }

  var rows = [];
  for (var summaryKey in summaryMap) {
    if (summaryMap.hasOwnProperty(summaryKey)) {
      rows.push(summaryMap[summaryKey]);
    }
  }

  return rows;
}

function formatSpanishDateRange(startDate, endDate) {
  var MONTHS = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  function toDateParts(value) {
    if (!value) {
      return null;
    }

    var dateObj = null;

    if (Object.prototype.toString.call(value) === "[object Date]") {
      dateObj = value;
    } else if (typeof value.getTime === "function") {
      dateObj = new Date(value.getTime());
    } else {
      var parsed = new Date(String(value));
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return null;
    }

    return {
      day: dateObj.getDate(),
      month: dateObj.getMonth(),
      year: dateObj.getFullYear()
    };
  }

  var start = toDateParts(startDate);
  var end = toDateParts(endDate);

  if (!start && !end) {
    return "";
  }
  if (!start) {
    return end.day + " de " + MONTHS[end.month] + " del año " + end.year;
  }
  if (!end) {
    return start.day + " de " + MONTHS[start.month] + " del año " + start.year;
  }
  if (start.month === end.month && start.year === end.year) {
    return start.day + " al " + end.day + " de " + MONTHS[start.month] + " del año " + start.year;
  }
  return (
    start.day + " de " + MONTHS[start.month] +
    " al " + end.day + " de " + MONTHS[end.month] +
    " del año " + end.year
  );
}

function sanitizeFileNameToken(value) {
  return String(value).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function keyMatchesAssocName(key, shortName) {
  if (!key) {
    return false;
  }
  return key === shortName || key === "vso:" + shortName || key.indexOf("}" + shortName) !== -1 || key.indexOf(":" + shortName) !== -1;
}

function collectAssocNodesByShortName(node, shortName) {
  var buckets = [node ? node.assocs : null, node ? node.sourceAssocs : null, node ? node.targetAssocs : null];
  var collectedByRef = {};
  var collected = [];

  for (var bi = 0; bi < buckets.length; bi++) {
    var bucket = buckets[bi];
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

      for (var ni = 0; ni < nodes.length; ni++) {
        var assocNode = nodes[ni];
        if (!assocNode || !assocNode.nodeRef) {
          continue;
        }
        var ref = assocNode.nodeRef.toString();
        if (!collectedByRef[ref]) {
          collectedByRef[ref] = true;
          collected.push(assocNode);
        }
      }
    }
  }

  return collected;
}

function lookupInspectionData(inspectionCode, providerId) {
  var inspectionFolderPath = VSO_PATHS.inspectionInProcessPath + "/" + inspectionCode;
  var inspectionFolder = companyhome.childByNamePath(inspectionFolderPath);

  if (!inspectionFolder || !inspectionFolder.exists()) {
    TemplateGeneration.fail(404, "Inspection not found: " + inspectionCode);
  }
  if (!inspectionFolder.isContainer) {
    TemplateGeneration.fail(409, "Inspection node is not a folder: " + inspectionCode);
  }

  var startDate = inspectionFolder.properties["vso:startDate"];
  var endDate = inspectionFolder.properties["vso:endDate"];
  var locationId = trimProp(inspectionFolder, "vso:locationId");
  var locationName = trimProp(inspectionFolder, "vso:locationName");
  var providerName = "";

  var findings = [];
  var checklistItemCodeById = {};
  var checklistItemCodeByFindingNodeRef = {};
  var checklistItemCodeByFindingNodeRefReverse = {};
  var allChildren = inspectionFolder.children;

  // Collect findings from direct children
  for (var ci = 0; ci < allChildren.length; ci++) {
    var child = allChildren[ci];
    if (!child.isSubType("vso:finding")) {
      continue;
    }
    if (trimProp(child, "vso:providerId") !== providerId) {
      continue;
    }
    if (!providerName) {
      providerName = trimProp(child, "vso:providerName");
    }

    var findingJson = {};
    try {
      findingJson = JSON.parse(String(child.content));
    } catch (parseErr) {}
    var findingPayload = findingJson.finding || findingJson;
    var findingItemId = trimProp(child, "vso:itemId") || findingPayload.itemId || "";
    var findingItemCode = findingItemId;

    findings.push({
      findingNode: child,
      findingNodeRef: child.nodeRef.toString(),
      itemId: findingItemId,
      itemCode: findingItemCode || findingItemId,
      specialtyName: trimProp(child, "vso:specialtyName") || trimProp(child, "vso:specialtyCode") || trimProp(child, "vso:specialtyId"),
      level: trimProp(child, "vso:findingLevel"),
      description: trimProp(child, "vso:description"),
      nationalRegulation: trimProp(child, "vso:nationalRegulation"),
      icaoReference: trimProp(child, "vso:icaoReference"),
      ceMapping: trimProp(child, "vso:ceMapping"),
      requirementText: findingPayload.requirementText || ""
    });
  }

  var checklistSummary = [];
  var domainFolders = inspectionFolder.childFileFolders(false, true);

  for (var di = 0; di < domainFolders.length; di++) {
    var domainFolder = domainFolders[di];
    var domainChildren = domainFolder.children;

    // Collect findings from domain folder
    for (var dfi = 0; dfi < domainChildren.length; dfi++) {
      var domainFinding = domainChildren[dfi];
      if (!domainFinding.isSubType("vso:finding")) {
        continue;
      }
      if (trimProp(domainFinding, "vso:providerId") !== providerId) {
        continue;
      }
      if (!providerName) {
        providerName = trimProp(domainFinding, "vso:providerName");
      }

      var domainFindingJson = {};
      try {
        domainFindingJson = JSON.parse(String(domainFinding.content));
      } catch (parseErr) {}
      var domainFindingPayload = domainFindingJson.finding || domainFindingJson;
      var domainFindingItemId = trimProp(domainFinding, "vso:itemId") || domainFindingPayload.itemId || "";
      var domainFindingItemCode = domainFindingItemId;

      findings.push({
        findingNode: domainFinding,
        findingNodeRef: domainFinding.nodeRef.toString(),
        itemId: domainFindingItemId,
        itemCode: domainFindingItemCode || domainFindingItemId,
        specialtyName: trimProp(domainFinding, "vso:specialtyName") || trimProp(domainFinding, "vso:specialtyCode") || trimProp(domainFinding, "vso:specialtyId"),
        level: trimProp(domainFinding, "vso:findingLevel"),
        description: trimProp(domainFinding, "vso:description"),
        nationalRegulation: trimProp(domainFinding, "vso:nationalRegulation"),
        icaoReference: trimProp(domainFinding, "vso:icaoReference"),
        ceMapping: trimProp(domainFinding, "vso:ceMapping"),
        requirementText: domainFindingPayload.requirementText || ""
      });
    }

    
    // Collect checklists from domain folder
    for (var dci = 0; dci < domainChildren.length; dci++) {
      var checklistNode = domainChildren[dci];
      if (!checklistNode.isSubType("vso:inspectionChecklist")) {
        continue;
      }
      var checklistMatchesProvider = trimProp(checklistNode, "vso:providerId") === providerId;
      if (!providerName && checklistMatchesProvider) {
        providerName = trimProp(checklistNode, "vso:providerName");
      }

      var itemNodes = checklistNode.children;
      for (var ici = 0; ici < itemNodes.length; ici++) {
        var itemNode = itemNodes[ici];
        if (!itemNode.isSubType("vso:checklistItem")) {
          continue;
        }

        var checklistItemId = trimProp(itemNode, "vso:itemId");
        var checklistItemCode = checklistItemId;
        if (checklistItemId) {
          checklistItemCodeById[checklistItemId] = checklistItemCode;
        }

        var linkedFindings = collectAssocNodesByShortName(itemNode, "hasFinding");
        if (linkedFindings) {
          if (!Array.isArray(linkedFindings)) {
            linkedFindings = [linkedFindings];
          }
          for (var lfi = 0; lfi < linkedFindings.length; lfi++) {
            var linkedFinding = linkedFindings[lfi];
            if (linkedFinding && linkedFinding.nodeRef) {
              checklistItemCodeByFindingNodeRef[linkedFinding.nodeRef.toString()] = checklistItemCode;
            }
          }
        }

        if (checklistMatchesProvider) {
          checklistSummary.push({
            itemCode: checklistItemCode,
            specialtyName: trimProp(itemNode, "vso:specialtyName") || trimProp(itemNode, "vso:specialtyCode") || trimProp(itemNode, "vso:specialtyId"),
            requirementText: trimProp(itemNode, "vso:requirementText"),
            complianceStatus: trimProp(itemNode, "vso:complianceStatus")
          });
        }
      }
    }
  }

  for (var fli = 0; fli < findings.length; fli++) {
    var findingEntry = findings[fli];
    var relatedChecklistItems = collectAssocNodesByShortName(findingEntry.findingNode, "hasFinding");
    if (!relatedChecklistItems || relatedChecklistItems.length === 0) {
      continue;
    }

    for (var rci = 0; rci < relatedChecklistItems.length; rci++) {
      var relatedChecklistItem = relatedChecklistItems[rci];
      if (!relatedChecklistItem || !relatedChecklistItem.isSubType || !relatedChecklistItem.isSubType("vso:checklistItem")) {
        continue;
      }
      var reverseItemCode = trimProp(relatedChecklistItem, "vso:itemId");
      if (reverseItemCode) {
        checklistItemCodeByFindingNodeRefReverse[findingEntry.findingNodeRef] = reverseItemCode;
        break;
      }
    }
  }

  for (var fi = 0; fi < findings.length; fi++) {
    var finding = findings[fi];
    if (finding.itemId && checklistItemCodeById[finding.itemId]) {
      finding.itemCode = checklistItemCodeById[finding.itemId];
    } else if (finding.findingNodeRef && checklistItemCodeByFindingNodeRef[finding.findingNodeRef]) {
      finding.itemCode = checklistItemCodeByFindingNodeRef[finding.findingNodeRef];
    } else if (finding.findingNodeRef && checklistItemCodeByFindingNodeRefReverse[finding.findingNodeRef]) {
      finding.itemCode = checklistItemCodeByFindingNodeRefReverse[finding.findingNodeRef];
    }
    delete finding.findingNode;
    delete finding.itemId;
    delete finding.findingNodeRef;
  }

  return {
    inspectionCode: inspectionCode,
    providerId: providerId,
    providerName: providerName,
    locationId: locationId,
    locationName: locationName,
    startDate: startDate,
    endDate: endDate,
    dateRange: formatSpanishDateRange(startDate, endDate),
    findings: findings,
    checklistSummary: checklistSummary,
    checklistSummaryTable: buildChecklistSummaryTable(checklistSummary)
  };
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

  var inspectionCode = TemplateGeneration.trimToNull(inputData.inspectionCode);
  if (inspectionCode === null) {
    TemplateGeneration.fail(400, "Missing required field: inspectionCode");
  }

  var providerId = TemplateGeneration.trimToNull(inputData.providerId);
  if (providerId === null) {
    TemplateGeneration.fail(400, "Missing required field: providerId");
  }

  var inspectors = Array.isArray(inputData.inspectors) ? inputData.inspectors : [];
  var mainInspector = TemplateGeneration.trimToNull(inputData.mainInspector) ||
    (inspectors.length > 0 ? (inspectors[0].name || "") : "");

  var reportData = lookupInspectionData(inspectionCode, providerId);
  reportData.inspectors = inspectors;
  reportData.mainInspector = mainInspector;
  reportData.reportDate = TemplateGeneration.trimToNull(inputData.reportDate) || new Date().toISOString().slice(0, 10);

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
      "cm:title": inputData.title || ("Informe de Inspección " + inspectionCode + " - " + (reportData.providerName || providerId)),
      "cm:description": "Auto-generated on " + new Date().toISOString(),
      "vso:inspectionId": inspectionCode,
      "vso:startDate": reportData.startDate,
      "vso:endDate": reportData.endDate,
      "vso:locationId": reportData.locationId,
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

  logger.info((result.isNewVersion ? "New minor version created for: " : "Successfully created document: ") + outputFile.name);
} catch (error) {
  logger.error("Unexpected error in inspection report generation: " + error.message);
  if (!model || !model.error) {
    TemplateGeneration.setError(500, "Internal server error: " + error.message);
  }
}
