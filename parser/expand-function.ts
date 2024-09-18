import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { getTSServer } from "./tsserver";

// TODO
// - given handler definition
// - find handler in codebase
// - look for anything it references
// - expand that code somehow?

function searchFile(
  filePath: string,
  searchString: string,
): ExpandedFunctionResult | null {
  console.log("Searching file:", filePath);
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
  );

  let result: ExpandedFunctionResult | null = null;

  function visit(node: ts.Node) {
    const isFunction =
      ts.isFunctionDeclaration(node) || ts.isArrowFunction(node);
    // if (isFunction) {
    //   console.log("matched function node:", node);
    //   console.log(node?.getText());
    // }
    if (isFunction && node?.getText() === searchString) {
      console.log("matched function!");
      const { line: startLine, character: startColumn } =
        sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const { line: endLine, character: endColumn } =
        sourceFile.getLineAndCharacterOfPosition(node.getEnd());

      const context: ExpandedFunctionContext = [];
      const program = ts.createProgram([filePath], {});
      const checker = program.getTypeChecker();

      const localDeclarations = new Set<string>();
      const usedIdentifiers = new Set<string>();

      // First pass: collect local declarations
      ts.forEachChild(node, function collectDeclarations(childNode) {
        if (ts.isVariableDeclaration(childNode) && childNode.name.kind === ts.SyntaxKind.Identifier) {
          localDeclarations.add((childNode.name as ts.Identifier).text);
        }
        if (ts.isParameter(childNode) && childNode.name.kind === ts.SyntaxKind.Identifier) {
          localDeclarations.add((childNode.name as ts.Identifier).text);
        }
        ts.forEachChild(childNode, collectDeclarations);
      });

      // Second pass: collect used identifiers
      ts.forEachChild(node, function collectIdentifiers(childNode) {
        if (ts.isIdentifier(childNode)) {
          // Check if the identifier is part of a property access
          // FIXME - if it's a property access on an out-of-scope variable, we should still include it
          if (ts.isPropertyAccessExpression(childNode.parent)) {
            // If it's the property name, skip it
            if (childNode === childNode.parent.name) {
              return;
            }
            // If it's the expression (left-hand side) and it's a local variable, skip it
            if (childNode === childNode.parent.expression && localDeclarations.has(childNode.text)) {
              return;
            }
          }

          // If it's not a local declaration and not part of a skipped property access, add it
          if (!localDeclarations.has(childNode.text)) {
            usedIdentifiers.add(childNode.text);
          }
        }
        ts.forEachChild(childNode, collectIdentifiers);
      });

      // Add out-of-scope identifiers to context
      // biome-ignore lint/complexity/noForEach: <explanation>
      usedIdentifiers.forEach(identifier => {
        // TODO - Add position!!!
        context.push({
          name: identifier,
          type: 'unknown', // We can't reliably get the type without a working symbol
          value: 'Out of scope or imported',
        });
      });

      console.log("contextttt", context);

      result = {
        file: filePath,
        startLine: startLine + 1,
        startColumn: startColumn + 1,
        endLine: endLine + 1,
        endColumn: endColumn + 1,
        context: context,
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

type ExpandedFunctionContext = Array<{
  /** The name of the constant or utility in the code */
  name: string;
  /** The type of the constant or utility (function, string, etc) */
  type: string;
  /** The stringified value of the constant or utility */
  value: string;
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
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
): Promise<ExpandedFunctionContext> {
  const context: ExpandedFunctionContext = [];

  // TODO: Implement logic to extract context
  // This should involve:
  // 1. Finding the node for the function
  // 2. Analyzing its dependencies (imports, referenced variables, etc.)
  // 3. Populating the context array with relevant information

  try {
    const connection = await getTSServer(projectRoot);

    // Open the document containing the function explicitly
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

    console.debug('Opened document:', funcFileUri);

    // const _definitionResponse = await connection.sendRequest('textDocument/definition', {
    //   textDocument: { uri: funcFileUri },
    //   position: { line: 0, character: 10 }
    // });

    // console.log("mehhhh response", JSON.stringify(_definitionResponse, null, 2));


    const definitionResponse = await connection.sendRequest('textDocument/definition', {
      textDocument: { uri: funcFileUri },
      position: { line: startLine - 1, character: startColumn - 1 }
    });

    console.log("response", definitionResponse);
    if (Array.isArray(definitionResponse) && definitionResponse.length > 0) {

      const definition = definitionResponse[0];
      console.log("definition", definition);
      context.push({
        name: definition.name || 'Unknown',
        type: 'function',
        value: `Defined in ${definition.uri}, line ${definition.range.start.line + 1}`
      });
    }

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
  const location = searchDir(srcPath, func);
  if (!location) {
    return null;
  }

  const context = await extractContext(
    projectRoot,
    location.file,
    location.startLine,
    location.startColumn,
    location.endLine,
    location.endColumn,
  );
  return {
    ...location,
    context,
  };
}
