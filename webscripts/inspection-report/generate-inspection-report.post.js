// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

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
    loadEntityProfile: function loadEntityProfile() {
      var fallback = {
        entityName: "DEPARTAMENTO DE CONTROL DE VIGILANCIA SNA/AGA",
        entityLogoBase64: "",
        docControlCodes: { informeFinal: "DVSO-CS-F04", planDeInspeccion: "DVSO-CS-F02" },
        docControlVersion: "3.0"
      };
      try {
        var file = new Packages.java.io.File("/usr/local/tomcat/shared/classes/alfresco/extension/entity-profile.json");
        if (!file.exists()) {
          return fallback;
        }
        var text = String(Packages.org.apache.commons.io.FileUtils.readFileToString(file, "UTF-8"));
        var parsed = JSON.parse(text);
        return {
          entityName: parsed.entityName || fallback.entityName,
          entityLogoBase64: parsed.entityLogoBase64 || fallback.entityLogoBase64,
          docControlCodes: parsed.docControlCodes || fallback.docControlCodes,
          docControlVersion: parsed.docControlVersion || fallback.docControlVersion
        };
      } catch (loadError) {
        return fallback;
      }
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

function trimProp(node, propName) {
  var val = node.properties[propName];
  if (val === null || val === undefined) {
    return "";
  }
  return String(val).replace(/^\s+|\s+$/g, "");
}

function firstNonEmptySpecialty() {
  function isPlaceholderValue(value) {
    var lowered = String(value).toLowerCase();
    return lowered === "unknown" || lowered === "desconocido" || lowered === "n/a" || lowered === "na";
  }

  for (var index = 0; index < arguments.length; index++) {
    var value = arguments[index];
    if (value !== null && value !== undefined) {
      var normalized = String(value); //.replace(/^\s+|\s+$/g, "");
      if (normalized.length > 0 && !isPlaceholderValue(normalized)) {
        return normalized;
      }
    }
  }
  return "";
}

function extractSpecialtyToken(value) {
  var normalized = firstNonEmptySpecialty(value);
  if (!normalized) {
    return "";
  }

  var hyphenMatch = normalized.match(/(?:^|[-_])([A-Za-z]{2,8})(?:[-_.]|$)/);
  if (hyphenMatch) {
    return hyphenMatch[1];
  }

  var parenMatch = normalized.match(/\(([A-Za-z]{2,8})\)/);
  if (parenMatch) {
    return parenMatch[1];
  }

  return "";
}

function resolveSpecialtyNameFromNodes(itemNode, checklistNode, domainFolder, inspectionFolder) {
  var specialty = firstNonEmptySpecialty(
    checklistNode ? trimProp(checklistNode, "vso:specialtyName") : "",
    checklistNode ? trimProp(checklistNode, "vso:specialtyCode") : "",
    checklistNode ? trimProp(checklistNode, "vso:specialtyId") : "",
    trimProp(itemNode, "vso:specialtyName"),
    trimProp(itemNode, "vso:specialtyCode"),
    trimProp(itemNode, "vso:specialtyId"),
    domainFolder ? trimProp(domainFolder, "vso:specialtyName") : "",
    domainFolder ? trimProp(domainFolder, "vso:specialtyCode") : "",
    domainFolder ? trimProp(domainFolder, "vso:specialtyId") : "",
    domainFolder ? domainFolder.name : "",
    checklistNode ? trimProp(checklistNode, "vso:checklistId") : "",
    checklistNode ? checklistNode.name : "",
    inspectionFolder ? trimProp(inspectionFolder, "vso:specialtyName") : "",
    inspectionFolder ? trimProp(inspectionFolder, "vso:specialtyCode") : "",
    inspectionFolder ? trimProp(inspectionFolder, "vso:specialtyId") : ""
  );

  if (specialty) {
    return specialty;
  }

  var itemCode = trimProp(itemNode, "vso:itemCode") || trimProp(itemNode, "vso:itemId");
  var prefixMatch = itemCode.match(/^([A-Za-z]{2,8})[-_]/);
  if (prefixMatch) {
    return prefixMatch[1];
  }

  return firstNonEmptySpecialty(
    extractSpecialtyToken(checklistNode ? trimProp(checklistNode, "vso:checklistId") : ""),
    extractSpecialtyToken(checklistNode ? checklistNode.name : ""),
    extractSpecialtyToken(domainFolder ? domainFolder.name : "")
  );
}

function buildChecklistSummaryTable(checklistData) {

  const MAX_STATUS = 3;
  var pivot = {};
  var titles = [];

  for (var index = 0; index < checklistData.length; index++) {
    var item = checklistData[index];
    var specialtyName = item.specialtyName || "Unknown";
    var complianceStatus = item.complianceStatus || "";

    if (!pivot[specialtyName]) {
      pivot[specialtyName] = { specialtyName: specialtyName, count : Array(MAX_STATUS).fill(0) };
    }

    var idx = titles.findIndex((x) => x === complianceStatus);
    if (idx == -1 ) {
      idx += titles.push(complianceStatus);
    }
    
    pivot[specialtyName].count[idx]++;
    
  }

  var rows = [];
  for (var key in pivot) {
    if (pivot.hasOwnProperty(key)) {
      rows.push(pivot[key]);
    }
  }

  return { "titles" : titles, "rows" : rows };

}

function buildFindingSpecs(findings) {
  function sortKey(value) {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value).toLowerCase();
  }

  var groupsByName = {};
  var grouped = [];

  for (var index = 0; index < findings.length; index++) {
    var finding = findings[index];
    var specialtyName = firstNonEmptySpecialty(finding.specialtyName, finding.domain, "Unknown");

    var group = groupsByName[specialtyName];
    if (!group) {
      group = {
        name: specialtyName,
        findings: []
      };
      groupsByName[specialtyName] = group;
      grouped.push(group);
    }

    group.findings.push({
      itemCode: finding.itemCode || "",
      level: finding.level || "",
      description: finding.description || "",
      nationalRegulation: finding.nationalRegulation || "",
      requirementText: finding.requirementText || ""
    });
  }

  for (var gi = 0; gi < grouped.length; gi++) {
    grouped[gi].findings.sort(function(a, b) {
      var aKey = sortKey(a.itemCode);
      var bKey = sortKey(b.itemCode);
      if (aKey < bKey) {
        return -1;
      }
      if (aKey > bKey) {
        return 1;
      }
      return 0;
    });
  }

  grouped.sort(function(a, b) {
    var aKey = sortKey(a.name);
    var bKey = sortKey(b.name);
    if (aKey < bKey) {
      return -1;
    }
    if (aKey > bKey) {
      return 1;
    }
    return 0;
  });

  return grouped;
}

function resolveRequirementTextForFinding(finding, itemRequirementTextByCode, itemCodeByFindingNodeRef, itemCodeByFindingNodeRefReverse) {
  var itemCode = finding.itemCode || "";
  if (itemCode && itemRequirementTextByCode[itemCode]) {
    return itemRequirementTextByCode[itemCode];
  }

  var findingNodeRef = finding.findingNodeRef || "";
  var mappedItemCode = null;
  if (findingNodeRef && itemCodeByFindingNodeRef[findingNodeRef]) {
    mappedItemCode = itemCodeByFindingNodeRef[findingNodeRef];
  } else if (findingNodeRef && itemCodeByFindingNodeRefReverse[findingNodeRef]) {
    mappedItemCode = itemCodeByFindingNodeRefReverse[findingNodeRef];
  }

  if (mappedItemCode && itemRequirementTextByCode[mappedItemCode]) {
    return itemRequirementTextByCode[mappedItemCode];
  }

  return "";
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

function resolveChecklistItemCode(itemNode) {
  var explicitCode = firstNonEmptySpecialty(trimProp(itemNode, "vso:itemCode"), trimProp(itemNode, "vso:checklistItemCode"));
  if (explicitCode) {
    return explicitCode;
  }

  var nodeName = itemNode && itemNode.name ? String(itemNode.name) : "";
  var nameCode = nodeName.replace(/\.json$/i, "").replace(/^\s+|\s+$/g, "");
  if (nameCode) {
    return nameCode;
  }

  return trimProp(itemNode, "vso:itemId");
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

function resolveAssocNodesByShortName(node, shortName) {
  var directMatches = collectAssocNodesByShortName(node, shortName);
  if (directMatches && directMatches.length > 0) {
    return directMatches;
  }
  if (!node || !node.nodeRef) {
    return [];
  }

  var reloadedNode = search.findNode(String(node.nodeRef));
  if (!reloadedNode) {
    return [];
  }
  return collectAssocNodesByShortName(reloadedNode, shortName);
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
  var findingNodeRefSeen = {};
  var checklistItemCodeById = {};
  var checklistItemCodeByFindingNodeRef = {};
  var checklistItemCodeByFindingNodeRefReverse = {};
  var checklistItemRequirementTextByCode = {};
  var observedSpecialtyFromChecklist = "";
  var firstDomainFolderName = "";

  function pushFindingFromNode(findingNode, findingNodeRef, specialtyName) {
    if (!findingNode || !findingNodeRef || findingNodeRefSeen[findingNodeRef]) {
      return;
    }
    var findingItemId = trimProp(findingNode, "vso:itemId");
    var findingItemCode = firstNonEmptySpecialty(
      trimProp(findingNode, "vso:checklistItemCode"),
      trimProp(findingNode, "vso:itemCode"),
      findingItemId
    );
    findingNodeRefSeen[findingNodeRef] = true;
    findings.push({
      findingNode: findingNode,
      findingNodeRef: findingNodeRef,
      itemId: findingItemId,
      itemCode: findingItemCode,
      domain: specialtyName,
      specialtyName: specialtyName,
      level: trimProp(findingNode, "vso:findingLevel"),
      description: trimProp(findingNode, "vso:description"),
      nationalRegulation: trimProp(findingNode, "vso:nationalRegulation"),
      icaoReference: trimProp(findingNode, "vso:icaoReference"),
      ceMapping: trimProp(findingNode, "vso:ceMapping"),
      requirementText: ""
    });
  }

  var checklistSummary = [];
  var interviewees = [];
  var intervieweesSeen = {};
  var regulationTitles = [];
  var regulationTitlesSeen = {};
  var domainFolders = inspectionFolder.childFileFolders(false, true);

  for (var di = 0; di < domainFolders.length; di++) {
    var domainFolder = domainFolders[di];
    firstDomainFolderName = firstNonEmptySpecialty(firstDomainFolderName, domainFolder ? domainFolder.name : "");
    var domainChildren = domainFolder.children;

    // Collect checklists from domain folder
    for (var dci = 0; dci < domainChildren.length; dci++) {
      var checklistNode = domainChildren[dci];
      if (!checklistNode.isSubType("vso:inspectionChecklist")) {
        continue;
      }

      var checklistInterviewee = trimProp(checklistNode, "vso:interviewee");
      if (checklistInterviewee && !intervieweesSeen[checklistInterviewee]) {
        intervieweesSeen[checklistInterviewee] = true;
        interviewees.push({ name: checklistInterviewee });
      }

      var checklistNodeContentSpecialty = firstNonEmptySpecialty(
        trimProp(checklistNode, "vso:specialtyName"),
        trimProp(checklistNode, "vso:specialtyCode"),
        trimProp(checklistNode, "vso:specialtyId")
      );
      observedSpecialtyFromChecklist = firstNonEmptySpecialty(
        observedSpecialtyFromChecklist,
        checklistNodeContentSpecialty,
        domainFolder ? domainFolder.name : "",
        extractSpecialtyToken(checklistNode ? checklistNode.name : "")
      );

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
        var checklistItemCode = resolveChecklistItemCode(itemNode);
        if (checklistItemId) {
          checklistItemCodeById[checklistItemId] = checklistItemCode;
        }
        if (checklistItemCode) {
          checklistItemRequirementTextByCode[checklistItemCode] = trimProp(itemNode, "vso:requirementText");
        }

        var linkedFindings = resolveAssocNodesByShortName(itemNode, "hasFinding");
        if (linkedFindings) {
          if (!Array.isArray(linkedFindings)) {
            linkedFindings = [linkedFindings];
          }
          for (var lfi = 0; lfi < linkedFindings.length; lfi++) {
            var linkedFinding = linkedFindings[lfi];
            if (linkedFinding && linkedFinding.nodeRef) {
              checklistItemCodeByFindingNodeRef[linkedFinding.nodeRef.toString()] = checklistItemCode;
              pushFindingFromNode(
                linkedFinding,
                linkedFinding.nodeRef.toString(),
                firstNonEmptySpecialty(
                  trimProp(linkedFinding, "vso:specialtyName"),
                  trimProp(linkedFinding, "vso:specialtyCode"),
                  trimProp(linkedFinding, "vso:specialtyId"),
                  trimProp(checklistNode, "vso:specialtyName"),
                  trimProp(checklistNode, "vso:specialtyCode"),
                  trimProp(checklistNode, "vso:specialtyId"),
                  domainFolder ? domainFolder.name : "",
                  trimProp(inspectionFolder, "vso:specialtyName"),
                  trimProp(inspectionFolder, "vso:specialtyCode"),
                  trimProp(inspectionFolder, "vso:specialtyId")
                )
              );
            }
          }
        }

        if (checklistMatchesProvider) {
          var checklistSpecialty = firstNonEmptySpecialty(
            resolveSpecialtyNameFromNodes(itemNode, checklistNode, domainFolder, inspectionFolder),
            checklistNodeContentSpecialty
          );
          checklistSummary.push({
            itemCode: checklistItemCode,
            domain: checklistSpecialty,
            specialtyName: checklistSpecialty,
            requirementText: trimProp(itemNode, "vso:requirementText"),
            complianceStatus: trimProp(itemNode, "vso:complianceStatus")
          });

          var itemNatReg = trimProp(itemNode, "vso:nationalRegulation");
          if (itemNatReg && !regulationTitlesSeen[itemNatReg]) {
            regulationTitlesSeen[itemNatReg] = true;
            regulationTitles.push({ title: itemNatReg });
          }
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
      var reverseItemCode = firstNonEmptySpecialty(trimProp(relatedChecklistItem, "vso:itemCode"), trimProp(relatedChecklistItem, "vso:itemId"));
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
    finding.requirementText = resolveRequirementTextForFinding(
      finding,
      checklistItemRequirementTextByCode,
      checklistItemCodeByFindingNodeRef,
      checklistItemCodeByFindingNodeRefReverse
    );
    delete finding.findingNode;
    delete finding.itemId;
    delete finding.findingNodeRef;
  }

  var inspectionSpecialtyFallback = firstNonEmptySpecialty(
    trimProp(inspectionFolder, "vso:specialtyName"),
    trimProp(inspectionFolder, "vso:specialtyCode"),
    trimProp(inspectionFolder, "vso:specialtyId"),
    observedSpecialtyFromChecklist,
    firstDomainFolderName
  );

  for (var csi = 0; csi < checklistSummary.length; csi++) {
    var summaryItem = checklistSummary[csi];
    var normalizedSpecialty = firstNonEmptySpecialty(
      summaryItem.specialtyName,
      summaryItem.domain,
      inspectionSpecialtyFallback
    );
    summaryItem.specialtyName = normalizedSpecialty;
    summaryItem.domain = normalizedSpecialty;
  }

  var findingSpecs = buildFindingSpecs(findings);
  const checklistTable = buildChecklistSummaryTable(checklistSummary);
  
  return {
    inspectionCode: inspectionCode,
    providerId: providerId,
    providerName: providerName,
    specialtyName: inspectionSpecialtyFallback,
    locationId: locationId,
    locationName: locationName,
    startDate: startDate,
    endDate: endDate,
    dateRange: formatSpanishDateRange(startDate, endDate),
    findingSpecs: findingSpecs,
    checklistSummary: checklistSummary,
    checklistSummaryTable: checklistTable.rows,
    titles : checklistTable.titles,
    interviewees: interviewees,
    regulationTitles: regulationTitles
  };
}

var VSO_PATHS = resolveVsoPaths();
var TEMPLATE_PATH = VSO_PATHS.inspectionReportTemplatePath || "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/Informe Final.fodt";
var DESTINATION_PATH = VSO_PATHS.inspectionReportTemplateDataPath || "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Template data";
var FILE_PREFIX = "Informe de inspeccion - ";
var FILE_EXTENSION = ".fodt";
var MIMETYPE = "application/vnd.oasis.opendocument.text";

// Locale-keyed static header labels for Informe Final.fodt. Keys correspond
// to ${labels.<key>} placeholders in the template.
var INFORME_FINAL_LABELS = {
  en: {
    formHeading: "FORM",
    codeLabel: "Code",
    versionLabel: "Version",
    docTitle: "FINAL REPORT",
    reportTitleLine1: "FINAL REPORT OF THE OPERATIONAL SAFETY",
    reportTitleLine2: "OVERSIGHT INSPECTION",
    directorateName: "OPERATIONAL SAFETY OVERSIGHT DIRECTORATE",
    sectionIdentification: "Identification of the Oversight Activity",
    activityLabel: "Oversight Activity",
    entityInspectedLabel: "Inspected Entity",
    activityTypeLabel: "Activity Type",
    modalityLabel: "Modality",
    modalityInPersonValue: "In-person",
    specialtiesAreasLabel: "Specialties/Areas",
    inspectionTeamLabel: "Inspection Team",
    entityStaffAccompanyingLabel: "Entity Staff in Attendance",
    dateAndPlaceLabel: "Date(s) and Location",
    sectionObjectiveScope: "Objectives and Scope of the Oversight Activity",
    sectionRegulatoryFramework: "Applicable Regulatory Framework",
    sectionActivitiesDescription: "Description of Activities Performed",
    sectionActivitySummary: "Summary of the Oversight Activity",
    specialtyHeading: "Specialty",
    sectionEntityResponsibility: "Responsibility of the Inspected Entity",
    correctiveActionResponsibilityText: "It is the responsibility of the inspected entity to prepare a corrective action plan for each finding and submit it to the DVSNA within the deadlines established in the findings reports, counted from receipt of the Final Report, as required by the applicable regulations.",
    sectionConclusions: "Conclusions and Comments:",
    sectionFindingsDetail: "Findings Detail",
    sectionSignatures: "Inspection Team Signatures:",
    inspectorRoleLabel: "Operational Safety Inspector",
    reviewedByLabel: "Reviewed by:",
    approvedByLabel: "Approved by:",
    leadInspectorTitle: "Lead Inspector",
    divisionHeadTitle: "Head, SNA Oversight Division",
    performedOnDateLabelLine1: "PERFORMED ON",
    performedOnDateLabelLine2: "THE DATE OF ",
    inspectionNoLabel: "INSPECTION NO. ",
    leadInspectorLabel: "Lead Inspector: ",
    objectiveLabel: "Objective: ",
    scopeLabel: "Scope: ",
    specialtyLabel: "Specialty: ",
    questionLabel: "Question ",
    findingClassLabel: "Finding class:",
    nationalRegulationLabel: "National regulation: ",
    findingDescriptionLabel: "Finding description: ",
    reportDateLabel: "Report preparation date: "
  },
  es: {
    formHeading: "FORMULARIO",
    codeLabel: "Código",
    versionLabel: "Versión",
    docTitle: "INFORME FINAL",
    reportTitleLine1: "INFORME FINAL DE INSPECCIÓN DE LA VIGILANCIA DE LA SEGURIDAD",
    reportTitleLine2: "OPERACIONAL",
    directorateName: "DIRECCIÓN DE VIGILANCIA DE LA SEGURIDAD OPERACIONAL",
    sectionIdentification: "Identificación de la actividad de vigilancia",
    activityLabel: "Actividad de vigilancia",
    entityInspectedLabel: "Entidad inspeccionada",
    activityTypeLabel: "Tipo de actividad",
    modalityLabel: "Modalidad",
    modalityInPersonValue: "Presencial",
    specialtiesAreasLabel: "Especialidades/Áreas",
    inspectionTeamLabel: "Equipo de inspección",
    entityStaffAccompanyingLabel: "Personal de la entidad que acompañó",
    dateAndPlaceLabel: "Fecha(s) y lugar",
    sectionObjectiveScope: "Objetivos y alcance de la actividad de vigilancia",
    sectionRegulatoryFramework: "Marco Normativo Aplicable",
    sectionActivitiesDescription: "Descripción de las actividades realizadas",
    sectionActivitySummary: "Resumen de la actividad de vigilancia",
    specialtyHeading: "Especialidad",
    sectionEntityResponsibility: "Responsabilidad de la entidad inspeccionada",
    correctiveActionResponsibilityText: "Es responsabilidad de la entidad inspeccionada elaborar un plan de acciones correctivas para cada hallazgo y enviarlo a la DVSNA en los plazos establecidos por los informes de hallazgos, contados a partir de haber recibido el Informe Final, como lo establece la reglamentación.",
    sectionConclusions: "Conclusiones y comentarios:",
    sectionFindingsDetail: "Detalle de Hallazgos",
    sectionSignatures: "Firmas del Equipo de Inspección:",
    inspectorRoleLabel: "Inspector de Seguridad Operacional",
    reviewedByLabel: "Revisado por:",
    approvedByLabel: "Aprobado por:",
    leadInspectorTitle: "Inspector Principal",
    divisionHeadTitle: "Encargado División de Vigilancia SNA",
    performedOnDateLabelLine1: "REALIZADO EN FECHA",
    performedOnDateLabelLine2: "DEL ",
    inspectionNoLabel: "INSPECCIÓN NO. ",
    leadInspectorLabel: "Inspector Líder: ",
    objectiveLabel: "Objetivo: ",
    scopeLabel: "Alcance: ",
    specialtyLabel: "Especialidad: ",
    questionLabel: "Pregunta ",
    findingClassLabel: "Clase de hallazgo:",
    nationalRegulationLabel: "Reglamentacion nacional: ",
    findingDescriptionLabel: "Descripcion hallazgo: ",
    reportDateLabel: "Fecha de elaboración del informe: "
  }
};

importTemplateGenerationLibrary();

try {
  requireMutationAccess("generating an inspection report");
  var inputData = TemplateGeneration.parseJsonPayload(requestbody.content);

  var inspectionCode = TemplateGeneration.trimToNull(inputData.inspectionCode);
  if (inspectionCode === null) {
    TemplateGeneration.fail(400, "Missing required field: inspectionCode");
  }
  assertSafeNodeName(inspectionCode, "inspectionCode");

  var providerId = TemplateGeneration.trimToNull(inputData.providerId);
  if (providerId === null) {
    TemplateGeneration.fail(400, "Missing required field: providerId");
  }

  var inspectors = Array.isArray(inputData.inspectors) ? inputData.inspectors : [];
  var services = Array.isArray(inputData.services) ? inputData.services : [];
  var mainInspector = TemplateGeneration.trimToNull(inputData.mainInspector) ||
    (inspectors.length > 0 ? (inspectors[0].name || "") : "");

  var reportData = lookupInspectionData(inspectionCode, providerId);
  var reportSpecialtyFallback = firstNonEmptySpecialty(reportData.specialtyName);
  if (reportSpecialtyFallback && Array.isArray(reportData.checklistSummaryTable)) {
    for (var rsi = 0; rsi < reportData.checklistSummaryTable.length; rsi++) {
      var summaryRow = reportData.checklistSummaryTable[rsi];
      var normalizedRowSpecialty = firstNonEmptySpecialty(summaryRow.domain, summaryRow.specialtyName, reportSpecialtyFallback);
      summaryRow.domain = normalizedRowSpecialty;
      summaryRow.specialtyName = normalizedRowSpecialty;
    }
  }
  var leadInspectorSpecialty = "";
  if (inspectors.length > 0 && inspectors[0]) {
    leadInspectorSpecialty = firstNonEmptySpecialty(
      inspectors[0].specialty,
      inspectors[0].specialtyName,
      inspectors[0].role
    );
  }
  reportData.specialtyName = firstNonEmptySpecialty(reportData.specialtyName, leadInspectorSpecialty);
  reportData.inspectors = inspectors;
  reportData.services = services;
  reportData.providerName = inputData.providerName;
  reportData.mainInspector = mainInspector;
  reportData.reportDate = TemplateGeneration.trimToNull(inputData.reportDate) || new Date().toISOString().slice(0, 10);
  reportData.description = TemplateGeneration.trimToNull(inputData.description) || "";
  reportData.conclusion = TemplateGeneration.trimToNull(inputData.conclusion) || "";
  reportData.objective = TemplateGeneration.trimToNull(inputData.objective) || "";
  reportData.scope = TemplateGeneration.trimToNull(inputData.scope) || "";
  reportData.inspectionType = TemplateGeneration.trimToNull(inputData.inspectionType) || "";

  var reportLocale = (TemplateGeneration.trimToNull(inputData.locale) === "en") ? "en" : "es";
  var entityProfile = TemplateGeneration.loadEntityProfile();
  reportData.entityName = entityProfile.entityName;
  reportData.entityLogoBase64 = entityProfile.entityLogoBase64;
  reportData.docControlCode = entityProfile.docControlCodes.informeFinal;
  reportData.docControlVersion = entityProfile.docControlVersion;
  reportData.labels = INFORME_FINAL_LABELS[reportLocale];

  // Repository paths are resolved from vso-paths.lib.js only. A caller must not
  // be able to redirect template reads or document writes with request fields.
  var templatePath = TEMPLATE_PATH;
  var destinationPath = DESTINATION_PATH;

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

  var templateRenderData = TemplateGeneration.xmlEscapeDeep(reportData);
  var generatedContent = TemplateGeneration.renderTemplateContent(templateNode, templateRenderData);
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
    inputData : (inputData ? JSON.stringify(inputData) : "No input data"),
    reportData : (reportData ? JSON.stringify(reportData) : "No report data"),
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
