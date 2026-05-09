{
  "success": ${(success!false)?c},
  "error": <#if error??>"${error?js_string}"<#else>null</#if>,
  "inspection": <#if inspection??>{
    "name": "${inspection.name?js_string}",
    "path": "${inspection.path?js_string}"
  }<#else>null</#if>,
  "domain": <#if domain??>{
    "name": "${domain.name?js_string}",
    "path": "${domain.path?js_string}"
  }<#else>null</#if>,
  "summary": <#if summary??>{
    "created": ${summary.created!0},
    "updated": ${summary.updated!0},
    "sourceDocuments": ${summary.sourceDocuments!0},
    "findingsImported": ${summary.findingsImported!0},
    "requested": ${summary.requested!0},
    "processed": ${summary.processed!0},
    "findingClosures": ${summary.findingClosures!0},
    "evidenceImported": ${summary.evidenceImported!0},
    "notFound": ${summary.notFound!0},
    "ambiguous": ${summary.ambiguous!0},
    "invalid": ${summary.invalid!0}
  }<#else>null</#if>,
  "followUpProcessing": <#if followUpProcessing??>{
    "sourceBasePath": <#if followUpProcessing.sourceBasePath??>"${followUpProcessing.sourceBasePath?js_string}"<#else>null</#if>,
    "sourceFolderPath": <#if followUpProcessing.sourceFolderPath??>"${followUpProcessing.sourceFolderPath?js_string}"<#elseif followUpProcessing.sourceBasePath??>"${followUpProcessing.sourceBasePath?js_string}"<#else>null</#if>,
    "details": [
    <#list (followUpProcessing.details![]) as detail>
      {
        "status": <#if detail.status??>"${detail.status?js_string}"<#else>null</#if>,
        "fileName": <#if detail.fileName??>"${detail.fileName?js_string}"<#else>null</#if>,
        "followUpId": <#if detail.followUpId??>"${detail.followUpId?js_string}"<#else>null</#if>,
        "findingId": <#if detail.findingId??>"${detail.findingId?js_string}"<#else>null</#if>,
        "message": <#if detail.message??>"${detail.message?js_string}"<#else>null</#if>,
        "matches": ${detail.matches!0},
        "sourceFolderPath": <#if detail.sourceFolderPath??>"${detail.sourceFolderPath?js_string}"<#elseif followUpProcessing.sourceFolderPath??>"${followUpProcessing.sourceFolderPath?js_string}"<#elseif followUpProcessing.sourceBasePath??>"${followUpProcessing.sourceBasePath?js_string}"<#else>null</#if>,
        "suggestions": [
        <#list (detail.suggestions![]) as suggestion>
          "${suggestion?js_string}"<#if suggestion_has_next>,</#if>
        </#list>
        ]
      }<#if detail_has_next>,</#if>
    </#list>
    ]
  }<#else>null</#if>,
  "importedSources": [
  <#list (importedSources![]) as source>
    {
      "name": "${source.name?js_string}",
      "type": "${source.type?js_string}",
      "path": "${source.path?js_string}"
    }<#if source_has_next>,</#if>
  </#list>
  ]
}