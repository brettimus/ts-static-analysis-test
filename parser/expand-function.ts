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
    if (isFunction) {
      console.log("matched function node:", node);
      console.log(node?.getText());
    }
    if (isFunction && node?.getText() === searchString) {
      console.log("matched function!");
      const { line: startLine, character: startColumn } =
        sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const { line: endLine, character: endColumn } =
        sourceFile.getLineAndCharacterOfPosition(node.getEnd());

      result = {
        file: filePath,
        startLine: startLine + 1,
        startColumn: startColumn + 1,
        endLine: endLine + 1,
        endColumn: endColumn + 1,
        context: [], // You may want to implement context extraction here
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
    const connection = getTSServer(projectRoot);
    const response = await connection.sendRequest('textDocument/definition', {
      textDocument: { uri: `file://${filePath}` },
      position: { line: startLine - 1, character: startColumn - 1 }
    });

    if (Array.isArray(response) && response.length > 0) {
      const definition = response[0];
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
