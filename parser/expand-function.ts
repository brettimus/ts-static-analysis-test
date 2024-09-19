import * as fs from "node:fs";
import ts from "typescript";
import { URI } from "vscode-uri";
import { findNodeAtPosition } from "./ast-helpers";
import {
  type FunctionOutOfScopeIdentifiers,
  searchForFunction,
} from "./search-function";
import { getTSServer } from "./tsserver";

// NOTES
// - given handler definition
// - find handler in codebase
// - look for anything it references
// - expand that code
// - REPEAT for each reference

type ExpandedFunctionContext = Array<{
  /** The name of the constant or utility in the code */
  name: string;
  /** The type of the constant or utility (function, string, etc) */
  type: string;
  /** The position of the constant or utility in the code */
  position: { line: number; character: number };
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

export async function expandFunction(
  projectRoot: string,
  srcPath: string,
  func: string,
): Promise<ExpandedFunctionResult | null> {
  const searchResult = searchForFunction(srcPath, func);
  if (!searchResult) {
    return null;
  }

  const context = await extractContext(
    projectRoot,
    searchResult.file,
    searchResult.identifiers,
  );
  return {
    ...searchResult,
    context,
  };
}

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
    console.debug(
      "[debug] No out of scope identifiers found in function, skipping context extraction",
    );
    return [];
  }

  try {
    const connection = await getTSServer(projectRoot);

    // Open the document containing the function
    // We do this to get more information on the definitions of the function's out-of-scope identifiers
    const funcFileUri = `file://${filePath.replace(/\\/g, "/")}`;
    const fileContent = fs.readFileSync(filePath, "utf-8");
    await connection.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: funcFileUri,
        languageId: "typescript",
        version: 1,
        text: fileContent,
      },
    });

    console.debug("[debug] Opened document:", funcFileUri);

    for (const identifier of identifiers) {
      const definitionResponse = await connection.sendRequest(
        "textDocument/definition",
        {
          textDocument: { uri: funcFileUri },
          position: identifier.position,
        },
      );

      console.debug(
        `[debug] TS Lang Server definition response for ${identifier.name}:`,
        JSON.stringify(definitionResponse, null, 2),
      );

      if (Array.isArray(definitionResponse) && definitionResponse.length > 0) {
        const definition = definitionResponse[0];
        const definitionUri = URI.parse(definition.uri);
        const definitionFilePath = definitionUri.fsPath;

        // Read the file content for the file that contains the definition
        const fileContent = fs.readFileSync(definitionFilePath, "utf-8");

        // Parse the file to do ast analysis
        const sourceFile = ts.createSourceFile(
          definitionFilePath,
          fileContent,
          ts.ScriptTarget.Latest,
          true,
        );

        // Find the node at the definition position
        const node = findNodeAtPosition(sourceFile, definition.range.start);

        // If there's a node, we can try to extract the value of the definition
        if (node) {
          let valueText = "Unable to determine value";

          if (ts.isVariableDeclaration(node) && node.initializer) {
            valueText = node.initializer.getText(sourceFile);
          } else if (
            ts.isFunctionDeclaration(node) ||
            ts.isArrowFunction(node)
          ) {
            valueText = node.getText(sourceFile);
          } else if (
            ts.isIdentifier(node) &&
            ts.isVariableDeclaration(node.parent) &&
            node.parent.initializer
          ) {
            valueText = node.parent.initializer.getText(sourceFile);
          }

          const contextEntry = {
            name: identifier.name,
            type: identifier.type,
            position: identifier.position,
            definition: {
              uri: definition.uri,
              range: definition.range,
              text: valueText,
            },
          };

          console.debug(
            `[debug] context entry for ${identifier.name}`,
            contextEntry,
          );

          context.push(contextEntry);
        } else {
          console.warn(
            `AST parsing found no definition found for ${identifier.name} in ${definitionFilePath}`,
          );
        }
      } else {
        console.warn(
          `TSServer found no definition found for ${identifier.name}`,
        );
      }
    }
  } catch (error) {
    console.error("Error querying TSServer:", error);
  }

  return context;
}
