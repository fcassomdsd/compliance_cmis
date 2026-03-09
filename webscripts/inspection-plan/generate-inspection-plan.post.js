// Constants for better maintainability
var TEMPLATE_PATH = "Sites/vigilancia-de-la-so/documentLibrary/Documentos/Formatos/formato plan de inspeccion.fodt";
var DESTINATION_PATH = "Sites/vigilancia-de-la-so/documentLibrary/Inspecciones/Inspecciones/Planes de Inspeccion";
var FILE_PREFIX = "Plan de inspeccion - ";
var FILE_EXTENSION = ".fodt";
var MIMETYPE = "application/vnd.oasis.opendocument.text";

function MiniFreemarker() {

  // -------------------------
  // Public API
  // -------------------------
  this.render = function(template, data) {
    const tokens = tokenize(template);
    const ast = parse(tokens);
    return evaluate(ast.data, data);
  };

  // -------------------------
  // Tokenizer
  // -------------------------
  function tokenize(input) {        
    const tokens = [];
    var i = 0;

    while (i < input.length) {
      if (input.startsWith('${', i)) {
        var end = input.indexOf('}', i);
        if (end === -1) throw new Error('Unclosed ${ expression');
        tokens.push({
          type: 'variable',
          value: input.slice(i + 2, end).trim()
        });
        i = end + 1;
        continue;
      }

      if (input.startsWith('[#list', i)) {
        var end2 = input.indexOf(']', i);
        if (end2 === -1) throw new Error('Unclosed [#list]');
        tokens.push({
          type: 'list_open',
          value: input.slice(i + 6, end2).trim()
        });
        i = end2 + 1;
        continue;
      }

      if (input.startsWith('[/#list]', i)) {
        tokens.push({ type: 'list_close' });
        i += 8;
        continue;
      }

      // Text
      var next = findNextSpecial(input, i);
      if (next > i) {
         tokens.push({
          type: 'text',
          value: input.slice(i, next)
        });
      }
      i = next;
    }
    return tokens;
  }

  function findNextSpecial(input, start) {
    const markers = ['${', '[#list', '[/#list]'];
    const positions = markers
      .map(m => input.indexOf(m, start))
      .filter(i => i !== -1);

   if (positions.length) {
      return positions.reduce( (minimo, x) => (minimo < x ? minimo : x) );
    } else {
      return input.length;
    }

  }

  // -------------------------
  // Parser (AST builder)
  // -------------------------
  function parse(tokens) {
    
    function parseToken(token, tokenList) {
      switch (token.type) {
        case 'text' :
          return { count : 1, data : token };
          break;
        case 'variable' :
          const node = { count : 1, data : { type: 'variable', path: token.value } };
          return node;
          break;
        case 'list_open' :
          const parts = token.value.split(/\s+/);
          if (parts.length !== 3 || parts[1] !== 'as') {
            throw new Error('Invalid [#list] syntax');
          }
          
          const body = parse(tokenList);
          logger.error("body = " + JSON.stringify(body.data));
          return { count : body.count + 2,
                   data : {
                     type: 'list',
                     collection : parts[0],
                     item: parts[2],
                     body : body.data
                   }
                 };
        default :
          return {count : 1, data : null};
      }
    }
      
    const nodes = [];
    var index = 0;
    while (index < tokens.length && tokens[index].type != 'list_close') {
 
      var nodeData = parseToken(tokens[index], tokens.slice(index+1))
      nodes.push(nodeData.data);
      index += nodeData.count;
    }
    return { count : index, data : nodes };
  }
  

  // -------------------------
  // Evaluator
  // -------------------------
  function evaluate(nodes, context) {

    function evaluateNode(node, context) {

      switch (node.type) {
        case 'text' : 
          return node.value;
        
        case 'variable' : 
          var result = resolvePath(context, node.path);
          return result;
        
        case 'list' :
          const objectTree = resolvePath(context, node.collection);
          var listResult = Array.isArray(objectTree) 
            ? objectTree.reduce( (output, item) => {
                const newObj = Object.create(context);
                newObj[node.item] = item;
                return output + evaluate(node.body, newObj);
              }, '') 
            : '';
          return listResult;
          
        default:
          return '';
      }
    }

    return nodes.reduce( (output, subnode) => (output + evaluateNode(subnode, context)), '');
  }    

  // -------------------------
  // Safe property resolver
  // -------------------------
  function resolvePath(obj, path) {

    function resolvePart(subobj, part) {
      if (!subobj || typeof subobj !== 'object') {
        return '';
      }
      return (part in subobj) ? subobj[part] : '';
    }
      
    const parts = path.split('.');
    return parts.reduce( 
      (result, part) => resolvePart(result, part), 
      obj
    );
  }   
  
}

/**
 * Helper function to set error response
 */
function setError(code, message) {
    status.code = code;
    status.message = message;
    status.redirect = true;
    model = { error: message };
}

try {
    // 1. Validate request body
    var jsonString = requestbody.content;
    if (!jsonString || jsonString.trim().length === 0) {
        setError(400, "Request body is empty");
        throw new Error(model.error);
    }
    
    // 2. Parse JSON
    var inputData;
    try {
        inputData = JSON.parse(jsonString);
    } catch (e) {
        setError(400, "Invalid JSON: " + e.message);
        throw new Error(model.error);
    }
    
    // 3. Validate structure
    if (!inputData || typeof inputData !== 'object') {
        setError(400, "Invalid JSON payload structure");
        throw new Error(model.error);
    }
    
    // 4. Locate template
    var templateNode = companyhome.childByNamePath(TEMPLATE_PATH);
    if (!templateNode || !templateNode.exists()) {
        setError(500, "Template not found in repository");
        logger.error("Template not found at path: " + TEMPLATE_PATH);
        throw new Error(model.error);
    }
    
    // 6. Locate destination folder
    var destFolder = companyhome.childByNamePath(DESTINATION_PATH);
    if (!destFolder || !destFolder.exists()) {
        setError(500, "Destination folder not found");
        logger.error("Destination folder not found at path: " + DESTINATION_PATH);
        throw new Error(model.error);
    }
    
    // 7. Validate inspectionNo and build filename
    if (!inputData.inspectionNo) {
        setError(400, "Missing required field: inspectionNo");
        throw new Error(model.error);
    }
    var outputName = FILE_PREFIX + inputData.inspectionNo + FILE_EXTENSION;

    // 7.5. Get content
    var engine = new MiniFreemarker();
    var templateStr = String(templateNode.content);
    var generatedContent = engine.render(templateStr, inputData);

    // 8. Create document or check out new version if it already exists
    function createNewVersion(destination, fileName, content) {
    
      const outFile = destination.childByNamePath(fileName);
      if (!outFile.hasAspect("cm:versionable")) {
          outFile.addAspect("cm:versionable");
      }
      const workFile = outFile.checkout();
      workFile.content = content;
      
      return workFile.checkin("Update content via script", false);
    
    }
    
    function createNewFile(destination, fileName, content) {
    
      const outFile = destination.createFile(fileName);
      if (!outFile) {
        setError(500, "Failed to create output file");
        throw new Error(model.error);
      }
      outFile.addAspect("cm:versionable");
      
      outFile.content = content;
      outFile.save();
      
      return outFile;
    
    }
    
    var outputFile = (destFolder.childByNamePath(outputName)) 
        ? createNewVersion(destFolder, outputName, generatedContent) 
        : createNewFile(destFolder, outputName, generatedContent); 

    // 9. Set properties
    outputFile.mimetype = MIMETYPE;
    
    // Use proper property setting
    outputFile.properties["cm:title"] = inputData.title || "Generated Inspection Plan";
    outputFile.properties["cm:description"] = "Auto-generated on " + new Date().toISOString();
    outputFile.save();
    var isNewVersion = (outputFile.properties["cm.versionLabel"] != "1.0")
    
    // 10. Success response
    status.code = isNewVersion ? 200 : 201; // 200 Updated, 201 Created
    model.success = true;
    model.result = {
        nodeRef: outputFile.nodeRef.toString(),
        name: outputFile.name,
        url: outputFile.url,
        downloadUrl: outputFile.downloadUrl,
        path: destFolder.displayPath + "/" + outputFile.name,
        createdDate: outputFile.properties["cm:created"],
        version: outputFile.properties["cm:versionLabel"],
        isNewVersion: isNewVersion
    };
    
    // Optional: Log success
    logger.info((isNewVersion ? "New minor version created for: " : "Successfully created document: ") + outputFile.name);
    
} catch (e) {
    // Catch any unexpected errors
    logger.error("Unexpected error in document generation: " + e.message);
    setError(500, "Internal server error: " + e.message);
}
