{
  "status": "success",
  "generatedFile": {
    "name": "${result.name}",
    "path": "${result.path}",
    "version": "${result.version}",
    "input" : "${result.inputData}",
    "report" : "${result.reportData}",
    "downloadURL": "${result.downloadUrl}",
    "isNewVersion": ${result.isNewVersion?string("true", "false")}
  }
}
