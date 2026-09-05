// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Fernando A. Casso Rodriguez

if (typeof __VSO_PATHS === "undefined" || !__VSO_PATHS) {
  __VSO_PATHS = {
    inspectionInProcessPath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Inspecciones",
    canonicalSourceBasePath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Datos de campo",
    findingBasePath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Hallazgos",
    inspectionPlanTemplateDataPath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Template data",
    inspectionPlanTemplatePath: "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/formato plan de inspeccion.fodt",
    inspectionReportTemplateDataPath: "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Template data",
    inspectionReportTemplatePath: "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/Informe Final.fodt",
    checklistPdfTemplatePath: "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/Checklist Reporte.fodt",
    findingPdfTemplatePath: "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/Finding Reporte.fodt",
    followUpPdfTemplatePath: "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/FollowUp Reporte.fodt"
  };
}

// Note: importScript() has been observed to be unavailable (typeof "undefined")
// in at least one repo webscript's execution context (canonical-model-import),
// so this module can't be relied on to load via importScript there - that
// webscript inlines its own copy instead. Verify importability before adding a
// new importScript-based consumer of this module.
if (typeof TemplateGeneration === "undefined" || !TemplateGeneration) {
  TemplateGeneration = (function() {
    function trimToNull(value) {
      if (value === null || value === undefined) {
        return null;
      }

      var normalized = String(value).replace(/^\s+|\s+$/g, "");
      return normalized.length === 0 ? null : normalized;
    }

    function setError(code, message) {
      status.code = code;
      status.message = message;
      status.redirect = true;
      model = { error: message };
    }

    function fail(code, message) {
      setError(code, message);
      throw new Error(message);
    }

    function parseJsonPayload(rawContent) {
      var payload = trimToNull(rawContent);
      if (payload === null) {
        fail(400, "Request body is empty");
      }

      var parsed;
      try {
        parsed = JSON.parse(payload);
      } catch (error) {
        fail(400, "Invalid JSON: " + error.message);
      }

      if (!parsed || typeof parsed !== "object") {
        fail(400, "Invalid JSON payload structure");
      }

      return parsed;
    }

    function MiniFreemarker() {
      this.render = function(template, data) {
        var tokens = tokenize(template);
        var ast = parse(tokens);
        return evaluate(ast.data, data);
      };

      function tokenize(input) {
        var tokens = [];
        var index = 0;

        while (index < input.length) {
          if (input.indexOf("${", index) === index) {
            var variableEnd = input.indexOf("}", index);
            if (variableEnd === -1) {
              throw new Error("Unclosed ${ expression");
            }

            tokens.push({
              type: "variable",
              value: input.slice(index + 2, variableEnd).trim()
            });
            index = variableEnd + 1;
            continue;
          }

          if (input.indexOf("[#list", index) === index) {
            var listEnd = input.indexOf("]", index);
            if (listEnd === -1) {
              throw new Error("Unclosed [#list]");
            }

            tokens.push({
              type: "list_open",
              value: input.slice(index + 6, listEnd).trim()
            });
            index = listEnd + 1;
            continue;
          }

          if (input.indexOf("[/#list]", index) === index) {
            tokens.push({ type: "list_close" });
            index += 8;
            continue;
          }

          var nextTokenIndex = findNextSpecial(input, index);
          if (nextTokenIndex > index) {
            tokens.push({
              type: "text",
              value: input.slice(index, nextTokenIndex)
            });
          }
          index = nextTokenIndex;
        }

        return tokens;
      }

      function findNextSpecial(input, start) {
        var markers = ["${", "[#list", "[/#list]"];
        var nearest = input.length;

        for (var markerIndex = 0; markerIndex < markers.length; markerIndex++) {
          var markerPos = input.indexOf(markers[markerIndex], start);
          if (markerPos !== -1 && markerPos < nearest) {
            nearest = markerPos;
          }
        }

        return nearest;
      }

      function parse(tokens) {
        function parseToken(token, tokenList) {
          if (token.type === "text") {
            return { count: 1, data: token };
          }

          if (token.type === "variable") {
            return {
              count: 1,
              data: {
                type: "variable",
                path: token.value
              }
            };
          }

          if (token.type === "list_open") {
            var parts = token.value.split(/\s+/);
            if (parts.length !== 3 || parts[1] !== "as") {
              throw new Error("Invalid [#list] syntax");
            }

            var body = parse(tokenList);
            return {
              count: body.count + 2,
              data: {
                type: "list",
                collection: parts[0],
                item: parts[2],
                body: body.data
              }
            };
          }

          return { count: 1, data: null };
        }

        var nodes = [];
        var tokenIndex = 0;

        while (tokenIndex < tokens.length && tokens[tokenIndex].type !== "list_close") {
          var node = parseToken(tokens[tokenIndex], tokens.slice(tokenIndex + 1));
          nodes.push(node.data);
          tokenIndex += node.count;
        }

        return { count: tokenIndex, data: nodes };
      }

      function evaluate(nodes, context) {
        function evaluateNode(node, currentContext) {
          if (!node) {
            return "";
          }

          if (node.type === "text") {
            return node.value;
          }

          if (node.type === "variable") {
            return resolvePath(currentContext, node.path);
          }

          if (node.type === "list") {
            var collection = resolvePath(currentContext, node.collection);
            if (!Array.isArray(collection)) {
              return "";
            }

            var listOutput = "";
            for (var elementIndex = 0; elementIndex < collection.length; elementIndex++) {
              var itemContext = Object.create(currentContext || {});
              itemContext[node.item] = collection[elementIndex];
              listOutput += evaluate(node.body, itemContext);
            }
            return listOutput;
          }

          return "";
        }

        var output = "";
        for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
          output += evaluateNode(nodes[nodeIndex], context);
        }

        return output;
      }

      function resolvePath(objectRoot, path) {
        var context = objectRoot;
        var parts = String(path).split(".");

        for (var index = 0; index < parts.length; index++) {
          if (!context || typeof context !== "object") {
            return "";
          }

          var part = parts[index];
          if (!(part in context)) {
            return "";
          }

          context = context[part];
        }

        if (context === null || context === undefined) {
          return "";
        }

        return context;
      }
    }

    function ensureAspect(node, aspectName) {
      if (!node.hasAspect(aspectName)) {
        node.addAspect(aspectName);
      }
    }

    function setProperties(node, properties) {
      if (!properties) {
        return;
      }

      for (var propertyName in properties) {
        if (properties.hasOwnProperty(propertyName)) {
          var value = properties[propertyName];
          if (value !== null && value !== undefined) {
            node.properties[propertyName] = value;
          }
        }
      }
    }

    function upsertDocument(options) {
      var destinationFolder = options.destinationFolder;
      var fileName = options.fileName;
      var nodeType = options.nodeType || "vso:vsoContent";
      var aspects = options.aspects || ["cm:versionable"];
      var versionComment = options.versionComment || "Update content via script";
      var existingNode = destinationFolder.childByNamePath(fileName);
      var outputNode;
      var isNewVersion = false;

      if (existingNode) {
        if (!existingNode.isDocument) {
          fail(409, "Destination node exists but is not a document: " + fileName);
        }

        for (var aspectIndex = 0; aspectIndex < aspects.length; aspectIndex++) {
          ensureAspect(existingNode, aspects[aspectIndex]);
        }

        var workingCopy = existingNode.checkout();
        workingCopy.content = options.content;
        if (options.mimetype) {
          workingCopy.mimetype = options.mimetype;
        }
        outputNode = workingCopy.checkin(versionComment, false);
        isNewVersion = true;
      } else {
        outputNode = destinationFolder.createNode(fileName, nodeType);
        if (!outputNode) {
          fail(500, "Failed to create output file");
        }

        for (var newAspectIndex = 0; newAspectIndex < aspects.length; newAspectIndex++) {
          ensureAspect(outputNode, aspects[newAspectIndex]);
        }

        outputNode.content = options.content;
        if (options.mimetype) {
          outputNode.mimetype = options.mimetype;
        }
      }

      setProperties(outputNode, options.properties);
      outputNode.save();

      return {
        node: outputNode,
        isNewVersion: isNewVersion
      };
    }

    function renderTemplateContent(templateNode, data) {
      var engine = new MiniFreemarker();
      var templateAsString = String(templateNode.content);
      return engine.render(templateAsString, data);
    }

    // MiniFreemarker does plain string substitution with no XML-escaping of its
    // own, so any free-text field (entity name, comments, descriptions, etc.)
    // must be escaped before it's substituted into a .fodt template - otherwise
    // a value containing &, <, or > corrupts the generated XML. Recurses through
    // arrays/objects so it can be applied once to a whole data object.
    function xmlEscapeDeep(value) {
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
    }

    // Uses Alfresco's local Transform Service (transform-core-aio) via the native
    // ScriptNode API. Returns a new transient ScriptNode holding the PDF content,
    // or null if the source node has no content or no transform is available.
    function convertToPdf(sourceNode) {
      if (!sourceNode || typeof sourceNode.transformDocument !== "function") {
        return null;
      }
      return sourceNode.transformDocument("application/pdf");
    }

    // Deployment-level entity/branding config (name, logo, document-control
    // codes) for the regulatory report templates - independent of any single
    // request's `locale`. Mounted into the container at build/deploy time
    // (see docker-compose.yml) alongside vsoModel.xml/vsoModel.properties.
    // Falls back to IDAC's own current values if the file can't be read, so a
    // deployment that never sets this up renders exactly as it did before
    // entity/locale parametrization was introduced.
    var ENTITY_PROFILE_FALLBACK = {
      entityName: "DEPARTAMENTO DE CONTROL DE VIGILANCIA SNA/AGA",
      entityLogoBase64: "",
      docControlCodes: { informeFinal: "DVSO-CS-F04", planDeInspeccion: "DVSO-CS-F02" },
      docControlVersion: "3.0"
    };

    function loadEntityProfile() {
      try {
        var file = new Packages.java.io.File("/usr/local/tomcat/shared/classes/alfresco/extension/entity-profile.json");
        if (!file.exists()) {
          return ENTITY_PROFILE_FALLBACK;
        }
        var text = String(Packages.org.apache.commons.io.FileUtils.readFileToString(file, "UTF-8"));
        var parsed = JSON.parse(text);
        return {
          entityName: parsed.entityName || ENTITY_PROFILE_FALLBACK.entityName,
          entityLogoBase64: parsed.entityLogoBase64 || ENTITY_PROFILE_FALLBACK.entityLogoBase64,
          docControlCodes: parsed.docControlCodes || ENTITY_PROFILE_FALLBACK.docControlCodes,
          docControlVersion: parsed.docControlVersion || ENTITY_PROFILE_FALLBACK.docControlVersion
        };
      } catch (loadError) {
        return ENTITY_PROFILE_FALLBACK;
      }
    }

    return {
      trimToNull: trimToNull,
      setError: setError,
      fail: fail,
      parseJsonPayload: parseJsonPayload,
      renderTemplateContent: renderTemplateContent,
      xmlEscapeDeep: xmlEscapeDeep,
      loadEntityProfile: loadEntityProfile,
      upsertDocument: upsertDocument,
      convertToPdf: convertToPdf
    };
  })();
}