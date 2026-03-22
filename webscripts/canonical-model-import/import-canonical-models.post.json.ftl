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
    "created": ${summary.created},
    "updated": ${summary.updated},
    "sourceDocuments": ${summary.sourceDocuments},
    "findingsImported": ${summary.findingsImported}
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