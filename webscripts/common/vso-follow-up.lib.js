(function() {
  function trimToNull(value) {
    if (value === null || value === undefined) {
      return null;
    }

    var normalized = String(value).replace(/^\s+|\s+$/g, "");
    return normalized.length === 0 ? null : normalized;
  }

  function padNumber(value, size) {
    var parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) {
      return null;
    }

    var text = String(parsed);
    while (text.length < size) {
      text = "0" + text;
    }

    return text;
  }

  function extractTrailingDigits(value) {
    var normalized = trimToNull(value);
    if (normalized === null) {
      return null;
    }

    var match = String(normalized).match(/(\d+)$/);
    return match ? match[1] : null;
  }

  function parseFindingParts(findingId) {
    var normalized = trimToNull(findingId);
    if (normalized === null) {
      return null;
    }

    var match = String(normalized).toUpperCase().match(/^([A-Z0-9]+)-([A-Z0-9]+)-(\d{1,})$/);
    if (!match) {
      return null;
    }

    var findingSequence = padNumber(match[3], 2);
    if (findingSequence === null) {
      return null;
    }

    return {
      findingId: match[1] + "-" + match[2] + "-" + findingSequence,
      reducedFindingId: match[1] + match[2] + "-" + findingSequence,
      findingSequence: findingSequence
    };
  }

  function normalizeCapIdentifier(value) {
    var normalized = trimToNull(value);
    if (normalized === null) {
      return null;
    }

    if (normalized.indexOf("CA-") === 0) {
      return normalized;
    }

    if (normalized.indexOf("CAP-") === 0) {
      return normalized.substring(4);
    }

    return normalized;
  }

  function normalizeCapCandidate(value) {
    var normalized = trimToNull(value);
    if (normalized === null) {
      return null;
    }

    normalized = normalized.replace(/\.json$/i, "");
    return normalizeCapIdentifier(normalized);
  }

  function buildCorrectiveActionId(findingId, capValue) {
    var findingParts = parseFindingParts(findingId);
    var capSequence = padNumber(extractTrailingDigits(capValue), 2);
    if (!findingParts || capSequence === null) {
      return null;
    }

    return "CA-" + findingParts.reducedFindingId + "-" + capSequence;
  }

  function buildFollowUpId(findingId, followUpSequence) {
    var findingParts = parseFindingParts(findingId);
    if (!findingParts) {
      return null;
    }

    var sequenceNumber = parseInt(followUpSequence, 10);
    if (isNaN(sequenceNumber) || sequenceNumber < 1 || sequenceNumber > 99) {
      return null;
    }

    var sequence = padNumber(sequenceNumber, 2);
    if (!sequence) {
      return null;
    }

    return "FU-" + findingParts.reducedFindingId + "-" + sequence;
  }

  function parseFollowUpSequenceFromId(followUpId, findingId) {
    var normalizedId = trimToNull(followUpId);
    var findingParts = parseFindingParts(findingId);
    if (!normalizedId || !findingParts) {
      return null;
    }

    var prefix = "FU-" + findingParts.reducedFindingId + "-";
    if (normalizedId.indexOf(prefix) !== 0) {
      return null;
    }

    var suffix = normalizedId.substring(prefix.length);
    if (!/^\d{2}$/.test(suffix)) {
      return null;
    }

    var parsed = parseInt(suffix, 10);
    return isNaN(parsed) || parsed < 1 ? null : parsed;
  }

  function validateClosurePolicy(followUpType, effectivenessConfirmed) {
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

  __VSO_FOLLOW_UP_HELPERS = {
    trimToNull: trimToNull,
    padNumber: padNumber,
    extractTrailingDigits: extractTrailingDigits,
    parseFindingParts: parseFindingParts,
    normalizeCapIdentifier: normalizeCapIdentifier,
    normalizeCapCandidate: normalizeCapCandidate,
    buildCorrectiveActionId: buildCorrectiveActionId,
    buildFollowUpId: buildFollowUpId,
    parseFollowUpSequenceFromId: parseFollowUpSequenceFromId,
    validateClosurePolicy: validateClosurePolicy
  };
})();
