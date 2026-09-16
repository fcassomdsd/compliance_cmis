{
  "status": "success",
  "generatedFile": {
    "name": "${(result.name!"")?json_string}",
    "path": "${(result.path!"")?json_string}",
    "version": "${(result.version!"")?json_string}",
    "input" : "${(result.inputData!"")?json_string}",
    "report" : "${(result.reportData!"")?json_string}",
    "downloadURL": "${(result.downloadUrl!"")?json_string}",
    "isNewVersion": ${result.isNewVersion?string("true", "false")}
  },
  "inspectionFolder": "${(result.inspectionFolder!"")?json_string}",
  "sourceName": "${(result.sourceName!"")?json_string}"
}
