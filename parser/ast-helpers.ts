import * as ts from "typescript";

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
