import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import type { MessageConnection } from "vscode-jsonrpc/node";
import { getFileUri, openFile } from "./tsserver";

export async function followImport(
  tsserver: MessageConnection,
  _projectRoot: string, // TODO - Use this to resolve node module imports
  currentFilePath: string,
  importNode: ts.ImportDeclaration,
  identifierNode: ts.Node,
) {
  debugger;
  const importPath = (importNode.moduleSpecifier as ts.StringLiteral).text;
  let resolvedPath: string;

  console.debug(`[debug] Import path: ${importPath}`);

  // TODO - Handle typescript config's aliased imports (`@/...`)
  if (importPath.startsWith(".")) {
    // Relative import
    resolvedPath = path.resolve(path.dirname(currentFilePath), importPath);
  } else {
    // NOTE - Skip node modules imports for now...
    // // Absolute import (assuming it's within the project)
    // resolvedPath = path.resolve(projectRoot, 'node_modules', importPath);

    return null;
  }

  console.debug(`[debug] Resolved import path: ${resolvedPath}`);

  // Add .ts extension if not present
  // TODO - Handle .tsx files, js files, etc.
  if (!resolvedPath.endsWith(".ts") && !resolvedPath.endsWith(".tsx")) {
    resolvedPath += ".ts";
  }

  if (!fs.existsSync(resolvedPath)) {
    console.warn(`Could not resolve import path: ${resolvedPath}`);
    return null;
  }

  await openFile(tsserver, resolvedPath);

  const importedFileContent = fs.readFileSync(resolvedPath, "utf-8");
  const importedSourceFile = ts.createSourceFile(
    resolvedPath,
    importedFileContent,
    ts.ScriptTarget.Latest,
    true,
  );

  // Find the exported declaration that matches the imported identifier
  const importClause = importNode.importClause;
  if (importClause?.name) {
    const importedIdentifier = importClause.name.text;
    const exportedDeclaration = findExportedDeclaration(
      importedSourceFile,
      importedIdentifier,
    );

    if (exportedDeclaration) {
      return {
        uri: getFileUri(resolvedPath),
        // TODO - Add actual range (missing end position)
        // range: exportedDeclaration.getSourceFile().getLineAndCharacterOfPosition(exportedDeclaration.getStart()),
        range: {
          start: exportedDeclaration
            .getSourceFile()
            .getLineAndCharacterOfPosition(exportedDeclaration.getStart()),
          end: exportedDeclaration
            .getSourceFile()
            .getLineAndCharacterOfPosition(exportedDeclaration.getEnd()),
        },
        text: exportedDeclaration.getText(),
      };
    }
  }

  return null;
}

function findExportedDeclaration(
  sourceFile: ts.SourceFile,
  identifierName: string,
): ts.Node | undefined {
  return sourceFile.statements.find((statement) => {
    if (
      ts.isExportAssignment(statement) &&
      ts.isIdentifier(statement.expression)
    ) {
      return statement.expression.text === identifierName;
    }
    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isVariableStatement(statement)
    ) {
      const modifiers = ts.getModifiers(statement);
      return (
        modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        ) &&
        (ts.isFunctionDeclaration(statement)
          ? statement.name?.text === identifierName
          : statement.declarationList.declarations[0].name.getText() ===
            identifierName)
      );
    }
    return false;
  });
}
