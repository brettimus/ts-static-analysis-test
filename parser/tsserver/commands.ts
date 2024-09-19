import fs from "node:fs";
import ts from "typescript";
import type { MessageConnection } from "vscode-jsonrpc/node";
import { URI } from "vscode-uri";
import { findNodeAtPosition } from "../ast-helpers/ast-helpers";
import { getFileUri } from "./utils";

export async function openFile(
  connection: MessageConnection,
  filePath: string,
) {
  const fileUri = getFileUri(filePath);
  // TODO - Check if we need to read the content of the file... shouldn't the server know how to do this from the workspace configuration?
  const fileContent = fs.readFileSync(filePath, "utf-8");
  await connection.sendNotification("textDocument/didOpen", {
    textDocument: {
      uri: fileUri,
      languageId: "typescript",
      version: 1,
      text: fileContent,
    },
  });

  console.debug("[debug] Opened document:", fileUri);
}

export async function getDefinition(
  connection: MessageConnection,
  fileUri: string,
  position: ts.LineAndCharacter,
  identifierName?: string,
) {
  const definitionResponse = await connection.sendRequest(
    "textDocument/definition",
    {
      textDocument: { uri: fileUri },
      position: position,
    },
  );

  if (identifierName) {
    console.debug(
      `[debug] TS Lang Server definition response for ${identifierName}:`,
      JSON.stringify(definitionResponse, null, 2),
    );
  }

  // INVESTIGATE - When is definitionResponse longer than 1?
  if (Array.isArray(definitionResponse) && definitionResponse.length > 0) {
    return definitionResponse[0];
  }

  return null;
}

// TODO - Move to ast helpers...
//
// biome-ignore lint/suspicious/noExplicitAny: We don't have a type for the definition response yet
export function definitionToNode(definition: any) {
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

  return { node, sourceFile };
}
