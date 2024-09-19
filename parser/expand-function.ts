import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { URI } from 'vscode-uri';
import { getTSServer } from "./tsserver";

// TODO
// - given handler definition
// - find handler in codebase
// - look for anything it references
// - expand that code somehow?

function searchFile(
  filePath: string,
  searchString: string,
): SearchFunctionResult | null {
  console.log("Searching file:", filePath);
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
  );

  let result: SearchFunctionResult | null = null;

  function visit(node: ts.Node) {
    const isFunction =
      ts.isFunctionDeclaration(node) || ts.isArrowFunction(node);
    // if (isFunction) {
    //   console.log("matched function node:", node);
    //   console.log(node?.getText());
    // }

    // Look for the matching function definition
    if (isFunction && node?.getText() === searchString) {
      console.log("matched function!");
      const { line: startLine, character: startColumn } =
        sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const { line: endLine, character: endColumn } =
        sourceFile.getLineAndCharacterOfPosition(node.getEnd());

      const identifiers: FunctionOutOfScopeIdentifiers = [];
      // const program = ts.createProgram([filePath], {});
      // const checker = program.getTypeChecker();

      // Now we want to determin all identifiers that are in scope,
      // and all identifiers that are used but not declared in the current function
      // We can do this by traversing the AST and collecting declarations and usages
      const localDeclarations = new Set<string>();
      const usedIdentifiers = new Map<string, ts.LineAndCharacter>();

      // First pass: recursively collect local declaration
      //
      // NOTE - This should not incur a stack overflow, in spite of its recursion,
      // because the function is not calling itself, it's passing itself to an iterator as a callback
      ts.forEachChild(node, function collectDeclarations(childNode) {
        if (ts.isVariableDeclaration(childNode) && childNode.name.kind === ts.SyntaxKind.Identifier) {
          localDeclarations.add(childNode.name.text);
        }
        if (ts.isParameter(childNode) && childNode.name.kind === ts.SyntaxKind.Identifier) {
          localDeclarations.add(childNode.name.text);
        }
        ts.forEachChild(childNode, collectDeclarations);
      });

      // Second pass: collect used identifiers
      // - If it's a property access on a declared local variable, skip it
      ts.forEachChild(node, function collectIdentifiers(childNode) {
        if (ts.isIdentifier(childNode)) {
          // Check if the identifier is part of a property access
          if (ts.isPropertyAccessExpression(childNode.parent)) {
            // If it's the property name, skip it
            if (childNode === childNode.parent.name) {
              return;
            }
            // If it's the expression (left-hand side) and it's a local variable, skip it
            if (childNode === childNode.parent.expression && localDeclarations.has(childNode.text)) {
              return;
            }
            // If it's the expression but not a local variable, include it
            // Example: Property accesse expression on an out-of-scope variable
            if (childNode === childNode.parent.expression) {
              const pos = sourceFile.getLineAndCharacterOfPosition(childNode.getStart());
              usedIdentifiers.set(childNode.text, pos);
              return;
            }
          }

          // If it's not a local declaration and not part of a skipped property access, add it
          if (!localDeclarations.has(childNode.text)) {
            const pos = sourceFile.getLineAndCharacterOfPosition(childNode.getStart());
            usedIdentifiers.set(childNode.text, pos);
          }
        }
        ts.forEachChild(childNode, collectIdentifiers);
      });

      // Add out-of-scope identifiers to context
      usedIdentifiers.forEach((position, identifier) => {
        identifiers.push({
          name: identifier,
          // We can't reliably get the type without a working symbol table,
          // which I think would require loading the entire project (all files) in to a 
          // typescript program and using its checker
          type: 'unknown',
          position,
        });
      });

      console.log("identifiers", identifiers);

      result = {
        file: filePath,
        startLine: startLine + 1,
        startColumn: startColumn + 1,
        endLine: endLine + 1,
        endColumn: endColumn + 1,
        identifiers,
      };
    }

    // Only continue traversing if we haven't found a match yet
    if (!result) {
      ts.forEachChild(node, visit);
    }
  }

  visit(sourceFile);

  return result;
}

function searchDir(dirPath: string, searchString: string) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      searchDir(filePath, searchString);
    } else if (
      stats.isFile() &&
      (file.endsWith(".ts") || file.endsWith(".tsx"))
    ) {
      const result = searchFile(filePath, searchString);
      if (result) {
        return result;
      }
    }
  }

  return null;
}



type FunctionOutOfScopeIdentifiers = Array<{
  /** The name of the constant or utility in the code */
  name: string;
  /** The type of the constant or utility (function, string, etc) */
  type: string;
  /** The position of the constant or utility in the code */
  position: ts.LineAndCharacter;
}>;


type SearchFunctionResult = {
  /** The file in which the function was found */
  file: string;
  /** The line on which the function definition starts */
  startLine: number;
  /** The column on which the function definition starts */
  startColumn: number;
  /** The line on which the function definition ends */
  endLine: number;
  /** The column on which the function definition ends */
  endColumn: number;
  identifiers: FunctionOutOfScopeIdentifiers;
};

type ExpandedFunctionContext = Array<{
  /** The name of the constant or utility in the code */
  name: string;
  /** The type of the constant or utility (function, string, etc) */
  type: string;
  /** The position of the constant or utility in the code */
  position: ts.LineAndCharacter;
  definition?: {
    uri: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    text: string;
  };
}>;

type ExpandedFunctionResult = {
  /** The file in which the function was found */
  file: string;
  /** The line on which the function definition starts */
  startLine: number;
  /** The column on which the function definition starts */
  startColumn: number;
  /** The line on which the function definition ends */
  endLine: number;
  /** The column on which the function definition ends */
  endColumn: number;
  context: ExpandedFunctionContext;
};

async function extractContext(
  projectRoot: string,
  filePath: string,
  identifiers: FunctionOutOfScopeIdentifiers,
): Promise<ExpandedFunctionContext> {
  const context: ExpandedFunctionContext = [];

  // TODO: Implement logic to extract context
  // This should involve:
  // 1. Finding the node for the function
  // 2. Analyzing its dependencies (imports, referenced variables, etc.)
  // 3. Populating the context array with relevant information

  if (!identifiers?.length) {
    return [];
  }

  try {
    const connection = await getTSServer(projectRoot);

    // Open the document containing the function
    const funcFileUri = `file://${filePath.replace(/\\/g, '/')}`;
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    await connection.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: funcFileUri,
        languageId: 'typescript',
        version: 1,
        text: fileContent,
      },
    });

    console.debug('[debug] Opened document:', funcFileUri);

    for (const identifier of identifiers) {
      const definitionResponse = await connection.sendRequest('textDocument/definition', {
        textDocument: { uri: funcFileUri },
        position: identifier.position
      });

      console.log(`Definition for ${identifier.name}:`, JSON.stringify(definitionResponse, null, 2));

      if (Array.isArray(definitionResponse) && definitionResponse.length > 0) {
        const definition = definitionResponse[0];

        console.debug(`[debug] definition response for ${identifier.name}`, definition)

        const definitionUri = URI.parse(definition.uri);
        const definitionFilePath = definitionUri.fsPath;

        // Read the file content
        const fileContent = fs.readFileSync(definitionFilePath, 'utf-8');

        // Parse the file
        const sourceFile = ts.createSourceFile(
          definitionFilePath,
          fileContent,
          ts.ScriptTarget.Latest,
          true
        );

        // Find the node at the definition position
        // const node = findNodeAtPosition(sourceFile, definition.range.start);


        // Extract the relevant text using the range
        const lines = fileContent.split('\n');
        const { start, end } = definition.range;
        const definitionText = lines
          .slice(start.line, end.line + 1)
          .map((line, index) => {
            if (index === 0 && index === end.line - start.line) {
              return line.substring(start.character, end.character);
            }
            if (index === 0) {
              return line.substring(start.character);
            }
            if (index === end.line - start.line) {
              return line.substring(0, end.character);
            }
            return line;
          })
          .join('\n');

        const contextEntry = {
          name: identifier.name,
          type: identifier.type,
          position: identifier.position,
          definition: {
            uri: definition.uri,
            range: definition.range,
            text: definitionText
          }
        }

        console.debug(`[debug] context entry for ${identifier.name}`, contextEntry)
        
        context.push(contextEntry);
      } else {
        console.log(`No definition found for ${identifier.name}`);
      }
    }

    // const _definitionResponse = await connection.sendRequest('textDocument/definition', {
    //   textDocument: { uri: funcFileUri },
    //   position: { line: 0, character: 10 }
    // });

    // console.log("mehhhh response", JSON.stringify(_definitionResponse, null, 2));


    // const definitionResponse = await connection.sendRequest('textDocument/definition', {
    //   textDocument: { uri: funcFileUri },
    //   position: { line: startLine - 1, character: startColumn - 1 }
    // });

    // console.log("response", definitionResponse);
    // if (Array.isArray(definitionResponse) && definitionResponse.length > 0) {

    //   const definition = definitionResponse[0];
    //   console.log("definition", definition);
    //   context.push({
    //     name: definition.name || 'Unknown',
    //     type: 'function',
    //     value: `Defined in ${definition.uri}, line ${definition.range.start.line + 1}`
    //   });
    // }

    // TODO: Add more requests to gather additional context
    // For example, you might want to get references, hover information, etc.

  } catch (error) {
    console.error('Error querying TSServer:', error);
  }

  return context;
}

export async function expandFunction(
  projectRoot: string,
  srcPath: string,
  func: string,
): Promise<ExpandedFunctionResult | null> {
  const searchResult = searchDir(srcPath, func);
  if (!searchResult) {
    return null;
  }

  const context = await extractContext(
    projectRoot,
    searchResult.file,
    searchResult.identifiers
  );
  return {
    ...searchResult,
    context,
  };
}
