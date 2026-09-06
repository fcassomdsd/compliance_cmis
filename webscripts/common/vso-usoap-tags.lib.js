// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

// Shared USOAP CE/area/PQ tagging logic (vso:usoapEvidenceContext /
// vso:regulatoryTraceability). Extracted so the citation-chain-driven import
// path (canonical-model-import) and the manual/Direct-tagging path
// (usoap/apply-direct-usoap-tag) apply the exact same rules, per the CLAUDE.md
// instruction to keep USOAP citation-chain and canonical-import logic in
// lockstep.
(function() {
  function trimToNull(value) {
    if (value === null || value === undefined) {
      return null;
    }
    var normalized = String(value).replace(/^\s+|\s+$/g, "");
    return normalized.length === 0 ? null : normalized;
  }

  function ensureAspect(node, aspectName) {
    if (!node.hasAspect(aspectName)) {
      node.addAspect(aspectName);
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

  /**
   * Applies chain-derived USOAP PQ/CE/area tags resolved by the Node-RED
   * citation chain (ICAO PQ -> Annex paragraph -> national regulation article
   * -> checklist item), as opposed to a manually/directly assigned tag.
   * usoapPqReference is an array of { code, criticalElement, areaCode }.
   */
  function applyChainDerivedUsoapTags(node, usoapPqReference) {
    if (!usoapPqReference || !usoapPqReference.length) {
      return;
    }
    ensureAspect(node, "vso:usoapEvidenceContext");

    var pqCodes = [];
    var ceValues = [];
    var areaValues = [];
    for (var index = 0; index < usoapPqReference.length; index++) {
      var entry = usoapPqReference[index] || {};
      if (entry.code) {
        pqCodes.push(entry.code);
      }
      if (entry.criticalElement) {
        ceValues.push(entry.criticalElement);
      }
      if (entry.areaCode) {
        areaValues.push(entry.areaCode);
      }
    }

    setMultiPropertyIfPresent(node, "vso:usoapPqReference", pqCodes);
    setMultiPropertyIfPresent(node, "vso:ceMapping", ceValues);
    setMultiPropertyIfPresent(node, "vso:areaMapping", areaValues);
    setPropertyIfPresent(node, "vso:usoapCriticalElement", usoapPqReference[0].criticalElement);
    setPropertyIfPresent(node, "vso:usoapAreaCode", usoapPqReference[0].areaCode);
    setPropertyIfPresent(node, "vso:usoapTagSource", "Chain-derived");
  }

  /**
   * Copies already-materialized USOAP tags from one saved node onto another,
   * e.g. from a finding onto its follow-up evidence. Unlike
   * applyChainDerivedUsoapTags, this reads real Alfresco property values
   * rather than the raw {code, criticalElement, areaCode} chain-resolution
   * shape.
   */
  function inheritUsoapTags(targetNode, sourceNode) {
    if (!sourceNode || !sourceNode.hasAspect("vso:usoapEvidenceContext")) {
      return;
    }
    ensureAspect(targetNode, "vso:usoapEvidenceContext");

    var scalarProps = ["vso:usoapCriticalElement", "vso:usoapAreaCode", "vso:usoapTagSource"];
    for (var index = 0; index < scalarProps.length; index++) {
      var value = sourceNode.properties[scalarProps[index]];
      if (value !== null && value !== undefined && value !== "") {
        targetNode.properties[scalarProps[index]] = value;
      }
    }

    var multiProps = ["vso:usoapPqReference", "vso:ceMapping", "vso:areaMapping"];
    for (var multiIndex = 0; multiIndex < multiProps.length; multiIndex++) {
      var multiValue = sourceNode.properties[multiProps[multiIndex]];
      if (multiValue && multiValue.length) {
        targetNode.properties[multiProps[multiIndex]] = multiValue;
      }
    }
  }

  var VALID_CE = ["CE-1", "CE-2", "CE-3", "CE-4", "CE-5", "CE-6", "CE-7", "CE-8"];
  var VALID_AREA = ["ATS", "CNS", "SAR", "AIM", "SMS", "MET", "AGA", "P/OPS", "CHT", "PEL", "OPS", "AIR", "FAL", "AVSEC", "DG", "ENV", "AIG"];
  // Must stay in sync with vso:usoapEvidenceBasisList (configs/model/vsoModel.xml).
  var VALID_EVIDENCE_BASIS = ["Primary Legislation", "Specific Regulation", "Technical Guidance", "Implementation Procedure", "Oversight Record"];
  var PQ_CODE_PATTERN = /^PQ [0-9]{1,2}\.[0-9]{3}$/;

  // Node types a human is allowed to apply a manual/Direct USOAP tag to.
  // The checklistItem/evidenceItem/finding leaves are included so a caller
  // can re-tag or correct one of those without a separate code path; every
  // other type here is a whole-artifact container that the citation-chain
  // import never tags automatically (see docs/usoap-evidence-structure.md).
  var DIRECT_TAG_ALLOWED_TYPES = [
    "vso:inspectionChecklist",
    "vso:inspection",
    "vso:correctiveAction",
    "vso:followUpReport",
    "cm:content",
    "vso:checklistItem",
    "vso:evidenceItem",
    "vso:finding"
  ];

  function isValidCe(value) {
    return VALID_CE.indexOf(value) !== -1;
  }

  function isValidArea(value) {
    return VALID_AREA.indexOf(value) !== -1;
  }

  function isValidEvidenceBasis(value) {
    return VALID_EVIDENCE_BASIS.indexOf(value) !== -1;
  }

  function isValidPqCode(value) {
    return typeof value === "string" && PQ_CODE_PATTERN.test(value);
  }

  /**
   * Applies a manually-curated ("Direct") USOAP tag to a whole-artifact node
   * -- a checklist, inspection, CAP, follow-up report, or plain document --
   * as opposed to the automated per-item chain resolution above. Always sets
   * usoapTagSource to "Direct"; callers must not use this to write
   * "Chain-derived" tags.
   *
   * tag: { criticalElement, areaCode, ceMapping, areaMapping, pqReferences,
   *        evidenceBasis }
   */
  function applyDirectUsoapTags(node, tag) {
    ensureAspect(node, "vso:usoapEvidenceContext");
    if ((tag.ceMapping && tag.ceMapping.length) || (tag.areaMapping && tag.areaMapping.length)) {
      ensureAspect(node, "vso:regulatoryTraceability");
    }

    setPropertyIfPresent(node, "vso:usoapCriticalElement", tag.criticalElement);
    setPropertyIfPresent(node, "vso:usoapAreaCode", tag.areaCode);
    setMultiPropertyIfPresent(node, "vso:usoapPqReference", tag.pqReferences);
    setMultiPropertyIfPresent(node, "vso:ceMapping", tag.ceMapping);
    setMultiPropertyIfPresent(node, "vso:areaMapping", tag.areaMapping);
    setPropertyIfPresent(node, "vso:usoapEvidenceBasis", tag.evidenceBasis);
    node.properties["vso:usoapTagSource"] = "Direct";
  }

  __VSO_USOAP_TAG_HELPERS = {
    ensureAspect: ensureAspect,
    setPropertyIfPresent: setPropertyIfPresent,
    setMultiPropertyIfPresent: setMultiPropertyIfPresent,
    applyChainDerivedUsoapTags: applyChainDerivedUsoapTags,
    inheritUsoapTags: inheritUsoapTags,
    applyDirectUsoapTags: applyDirectUsoapTags,
    isValidCe: isValidCe,
    isValidArea: isValidArea,
    isValidEvidenceBasis: isValidEvidenceBasis,
    isValidPqCode: isValidPqCode,
    // Callers check node-type membership via node.isSubType(...) against
    // each entry here, not string equality -- ScriptNode.type returns a
    // Clark-notation qualified name, not the "vso:x" prefixed form.
    DIRECT_TAG_ALLOWED_TYPES: DIRECT_TAG_ALLOWED_TYPES
  };
})();
