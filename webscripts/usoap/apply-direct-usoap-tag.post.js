// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

// Manual ("Direct") USOAP CE/area/PQ tagging for whole-artifact nodes -- a
// checklist, an inspection, a corrective action, a follow-up report, or a
// plain document (manual, license, training/personnel record) -- that the
// citation-chain-driven canonical import never tags automatically. See
// docs/usoap-evidence-structure.md, "Direct tagging (manual, whole-artifact)".

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

  // Fallback: reimplements the same validation/tagging logic in case the
  // shared lib cannot be imported in this environment, mirroring the
  // fallback pattern in canonical-model-import/import-canonical-models.post.js.
  var VALID_CE = ["CE-1", "CE-2", "CE-3", "CE-4", "CE-5", "CE-6", "CE-7", "CE-8"];
  var VALID_AREA = ["ATS", "CNS", "SAR", "AIM", "SMS", "MET", "AGA", "P/OPS", "CHT", "PEL", "OPS", "AIR", "FAL", "AVSEC", "DG", "ENV", "AIG"];
  var VALID_EVIDENCE_BASIS = ["Primary Legislation", "Specific Regulation", "Technical Guidance", "Implementation Procedure", "Oversight Record"];
  var PQ_CODE_PATTERN = /^PQ [0-9]{1,2}\.[0-9]{3}$/;
  var DIRECT_TAG_ALLOWED_TYPES = [
    "vso:inspectionChecklist", "vso:inspection", "vso:correctiveAction", "vso:followUpReport",
    "cm:content", "vso:checklistItem", "vso:evidenceItem", "vso:finding"
  ];

  function fbEnsureAspect(node, aspectName) {
    if (!node.hasAspect(aspectName)) {
      node.addAspect(aspectName);
    }
  }

  function fbSetPropertyIfPresent(node, propertyName, value) {
    var normalized = trimToNull(value);
    if (normalized !== null) {
      node.properties[propertyName] = normalized;
    }
  }

  function fbSetMultiPropertyIfPresent(node, propertyName, values) {
    if (!values || !values.length) {
      return;
    }
    var normalized = [];
    for (var i = 0; i < values.length; i++) {
      var trimmed = trimToNull(values[i]);
      if (trimmed !== null && normalized.indexOf(trimmed) === -1) {
        normalized.push(trimmed);
      }
    }
    if (normalized.length) {
      node.properties[propertyName] = normalized;
    }
  }

  return {
    isValidCe: function(value) {
      return VALID_CE.indexOf(value) !== -1;
    },
    isValidArea: function(value) {
      return VALID_AREA.indexOf(value) !== -1;
    },
    isValidPqCode: function(value) {
      return typeof value === "string" && PQ_CODE_PATTERN.test(value);
    },
    isValidEvidenceBasis: function(value) {
      return VALID_EVIDENCE_BASIS.indexOf(value) !== -1;
    },
    DIRECT_TAG_ALLOWED_TYPES: DIRECT_TAG_ALLOWED_TYPES,
    applyDirectUsoapTags: function(node, tag) {
      fbEnsureAspect(node, "vso:usoapEvidenceContext");
      if ((tag.ceMapping && tag.ceMapping.length) || (tag.areaMapping && tag.areaMapping.length)) {
        fbEnsureAspect(node, "vso:regulatoryTraceability");
      }
      fbSetPropertyIfPresent(node, "vso:usoapCriticalElement", tag.criticalElement);
      fbSetPropertyIfPresent(node, "vso:usoapAreaCode", tag.areaCode);
      fbSetMultiPropertyIfPresent(node, "vso:usoapPqReference", tag.pqReferences);
      fbSetMultiPropertyIfPresent(node, "vso:ceMapping", tag.ceMapping);
      fbSetMultiPropertyIfPresent(node, "vso:areaMapping", tag.areaMapping);
      fbSetPropertyIfPresent(node, "vso:usoapEvidenceBasis", tag.evidenceBasis);
      node.properties["vso:usoapTagSource"] = "Direct";
    }
  };
}

function trimToNull(value) {
  if (value === null || value === undefined) {
    return null;
  }
  var normalized = String(value).replace(/^\s+|\s+$/g, "");
  return normalized.length === 0 ? null : normalized;
}

function fail(code, message) {
  status.code = code;
  status.message = message;
  status.redirect = true;
  model.json = jsonUtils.toJSONString({ success: false, error: message });
  throw new Error(message);
}

function parseJsonPayload(rawContent) {
  var payload = trimToNull(rawContent);
  if (payload === null) {
    fail(400, "Request body is empty");
  }
  try {
    return JSON.parse(payload);
  } catch (error) {
    fail(400, "Invalid JSON: " + error.message);
  }
}

function normalizeStringArray(values, fieldName, validator) {
  if (values === null || values === undefined) {
    return [];
  }
  if (!Array.isArray(values)) {
    fail(400, fieldName + " must be an array of strings");
  }
  var normalized = [];
  for (var index = 0; index < values.length; index++) {
    var value = trimToNull(values[index]);
    if (value === null) {
      continue;
    }
    if (validator && !validator(value)) {
      fail(400, "Invalid value in " + fieldName + ": " + value);
    }
    normalized.push(value);
  }
  return normalized;
}

// node.type returns the Clark-notation qualified name (e.g.
// "{http://...}inspectionChecklist"), not the "vso:inspectionChecklist"
// prefixed form, so the allow-list check goes through isSubType (which
// resolves the "prefix:localname" form via the namespace service) rather
// than a plain string comparison against DIRECT_TAG_ALLOWED_TYPES.
function isAllowedNodeType(node, allowedTypes) {
  for (var index = 0; index < allowedTypes.length; index++) {
    if (node.isSubType(allowedTypes[index])) {
      return true;
    }
  }
  return false;
}

function resolveTargetNode(nodeId) {
  var normalized = trimToNull(nodeId);
  if (normalized === null) {
    fail(400, "Missing required parameter: nodeId");
  }
  var nodeRef = normalized.indexOf("workspace://") === 0
    ? normalized
    : "workspace://SpacesStore/" + normalized;

  var node = search.findNode(nodeRef);
  if (!node) {
    fail(404, "Node not found: " + normalized);
  }
  return node;
}

// Mutation endpoints are restricted to Alfresco administrators by default.
// Widen access without a code change by injecting a __VSO_SECURITY global (the
// same mechanism as __VSO_PATHS) shaped like
//   { "mutationGroups": ["GROUP_VSO_EDITORS"] }
// using fully-qualified cm:authorityName values.
function requireMutationAccess(operation) {
  if (people.isAdmin(person)) {
    return;
  }

  var allowed = [];
  if (typeof __VSO_SECURITY !== "undefined" && __VSO_SECURITY && __VSO_SECURITY.mutationGroups) {
    allowed = __VSO_SECURITY.mutationGroups;
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

function main() {
  requireMutationAccess("applying a direct USOAP tag");
  var helpers = resolveUsoapTagHelpers();
  var requestBody = parseJsonPayload(requestbody.content);

  var node = resolveTargetNode(requestBody.nodeId);

  if (!isAllowedNodeType(node, helpers.DIRECT_TAG_ALLOWED_TYPES)) {
    fail(400, "Direct USOAP tagging is not supported for node type " + node.type +
      ". Allowed types: " + helpers.DIRECT_TAG_ALLOWED_TYPES.join(", "));
  }

  var criticalElement = trimToNull(requestBody.criticalElement);
  if (criticalElement !== null && !helpers.isValidCe(criticalElement)) {
    fail(400, "Invalid criticalElement: " + criticalElement + ". Must be CE-1 through CE-8.");
  }

  var areaCode = trimToNull(requestBody.areaCode);
  if (areaCode !== null && !helpers.isValidArea(areaCode)) {
    fail(400, "Invalid areaCode: " + areaCode);
  }

  var ceMapping = normalizeStringArray(requestBody.ceMapping, "ceMapping", helpers.isValidCe);
  var areaMapping = normalizeStringArray(requestBody.areaMapping, "areaMapping", helpers.isValidArea);
  var pqReferences = normalizeStringArray(requestBody.pqReferences, "pqReferences", helpers.isValidPqCode);

  var evidenceBasis = trimToNull(requestBody.evidenceBasis);
  if (evidenceBasis !== null && !helpers.isValidEvidenceBasis(evidenceBasis)) {
    fail(400, "Invalid evidenceBasis: " + evidenceBasis);
  }

  if (!criticalElement && !areaCode && !ceMapping.length && !areaMapping.length && !pqReferences.length) {
    fail(400, "At least one of criticalElement, areaCode, ceMapping, areaMapping, or pqReferences is required");
  }

  helpers.applyDirectUsoapTags(node, {
    criticalElement: criticalElement,
    areaCode: areaCode,
    ceMapping: ceMapping,
    areaMapping: areaMapping,
    pqReferences: pqReferences,
    evidenceBasis: evidenceBasis
  });

  node.save();

  model.json = jsonUtils.toJSONString({
    success: true,
    nodeRef: String(node.nodeRef),
    nodeType: node.type,
    usoapCriticalElement: node.properties["vso:usoapCriticalElement"] || null,
    usoapAreaCode: node.properties["vso:usoapAreaCode"] || null,
    ceMapping: node.properties["vso:ceMapping"] || [],
    areaMapping: node.properties["vso:areaMapping"] || [],
    usoapPqReference: node.properties["vso:usoapPqReference"] || [],
    usoapTagSource: node.properties["vso:usoapTagSource"]
  });
}

main();
