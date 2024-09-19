import * as ts from "typescript";

export function getDefinitionText(node: ts.Node, sourceFile: ts.SourceFile) {
  // Variable declaration with initializer
  // `const y = ...`
  // `let x = ...`
  if (ts.isVariableDeclaration(node) && node.initializer) {
    return node.initializer.getText(sourceFile);
  }

  // Function declaration or arrow function
  // `function f() { ... }`
  // `(c) => { ... }`
  if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
    return node.getText(sourceFile);
  }

  // Check if the node is an identifier and if the parent node is a function declaration
  if (ts.isIdentifier(node) && ts.isFunctionDeclaration(node.parent)) {
    return node.parent.getText(sourceFile);
  }

  // Check if the node is an identifier and the parent node is a variable declaration with initializer
  // `const myVariable = someValue;`
  if (
    ts.isIdentifier(node) &&
    ts.isVariableDeclaration(node.parent) &&
    node.parent.initializer
  ) {
    return node.parent.initializer.getText(sourceFile);
  }

  return "Unable to determine value";
}

export function findNodeAtPosition(
  sourceFile: ts.SourceFile,
  position: { line: number; character: number },
): ts.Node | undefined {
  function find(node: ts.Node): ts.Node | undefined {
    if (positionInNode(sourceFile, node, position)) {
      return ts.forEachChild(node, find) || node;
    }
  }
  return find(sourceFile);
}

function positionInNode(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  position: { line: number; character: number },
): boolean {
  const { line, character } = position;
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return (
    start.line <= line &&
    line <= end.line &&
    (start.line < line || start.character <= character) &&
    (line < end.line || character <= end.character)
  );
}
