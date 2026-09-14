// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

// Mutation-endpoint authorization for the Web Scripts.
//
// The mutation Web Scripts (inspection plan, inspection report,
// canonical-model-import, follow-up-import, direct USOAP tag) allow Alfresco
// administrators and any member of the groups listed below. Values are
// fully-qualified cm:authorityName values, exactly as returned by
// people.getContainerGroups(); the comparison is case-sensitive.
//
// Every mutation Web Script keeps an inline copy of this list in its
// resolveVsoSecurity() fallback (importScript is not available in every
// execution context), so a change must be applied to all five files. Run
// scripts/verify-vso-security.sh to check they agree.
if (typeof __VSO_SECURITY === "undefined" || !__VSO_SECURITY) {
  __VSO_SECURITY = {
    mutationGroups: ["GROUP_U-VSO-WS_MUTATORS"]
  };
}
