import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

// TODO
// - given handler definition
// - find handler in codebase
// - look for anything it references
// - expand that code somehow?

// Add this at the top of your file
const honoInstances = new Set<string>();

function visitNode(node: ts.Node, sourceFile: ts.SourceFile | undefined) {
  if (!sourceFile) {
    console.error("SourceFile is undefined");
    return;
  }

  // Check for Hono instance creation
  if (
    ts.isVariableDeclaration(node) &&
    node.initializer &&
    ts.isNewExpression(node.initializer) &&
    ts.isIdentifier(node.initializer.expression) &&
    node.initializer.expression.text === "Hono"
  ) {
    if (ts.isIdentifier(node.name)) {
      honoInstances.add(node.name.text);
      console.log(`Found Hono instance: ${node.name.text}`);
    }
  }

  // Look for method calls (like app.get)
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression)
  ) {
    const methodName = node.expression.name.text;
    const objectName = node.expression.expression.getText(sourceFile);

    // Check if it's a Hono route definition
    if (
      honoInstances.has(objectName) &&
      ["get", "post", "put", "delete", "patch"].includes(methodName)
    ) {
      console.log(`Found Hono route: ${objectName}.${methodName}`);

      // Get the route path (first argument)
      if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
        console.log(`  Route path: ${node.arguments[0].text}`);
      }

      // Get the handler function (second argument)
      if (node.arguments.length > 1) {
        const handler = node.arguments[1];
        console.log(`  Handler: ${handler.getText(sourceFile)}`);
      }
    }
  }

  console.log(`Node kind: ${ts.SyntaxKind[node.kind]}`);

  try {
    // Log node positions without using getStart()
    console.log(`Node position: start=${node.pos}, end=${node.end}`);

    // Safely get line number
    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.pos);
    console.log(`Line number: ${lineAndChar.line + 1}`);

    // Add special handling for ImportDeclaration
    if (ts.isImportDeclaration(node)) {
      console.log("Import Declaration Details:");
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        console.log(`  Module: ${node.moduleSpecifier.text}`);
      }
      if (node.importClause) {
        if (node.importClause.name) {
          console.log(`  Default import: ${node.importClause.name.text}`);
        }
        if (node.importClause.namedBindings) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            const namedImports = node.importClause.namedBindings.elements.map(
              (e) => e.name.text,
            );
            console.log(`  Named imports: ${namedImports.join(", ")}`);
          } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
            console.log(
              `  Namespace import: ${node.importClause.namedBindings.name.text}`,
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("Error accessing node information:", error);
    console.log("Node:", JSON.stringify(node, null, 2));
  }

  console.log("---");

  ts.forEachChild(node, (child) => visitNode(child, sourceFile));
}

function createProgram(filePath: string): ts.Program {
  const configPath = ts.findConfigFile(
    path.dirname(filePath),
    ts.sys.fileExists,
    "tsconfig.json",
  );

  if (!configPath) {
    throw new Error("Could not find a valid 'tsconfig.json'.");
  }

  const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
  const { options, fileNames } = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    path.dirname(configPath),
  );

  return ts.createProgram(fileNames, options);
}

function analyzeFile(filePath: string) {
  console.log(`Analyzing file: ${filePath}`);
  const program = createProgram(filePath);
  const sourceFile = program.getSourceFile(filePath);

  if (sourceFile) {
    console.log(`SourceFile found for: ${filePath}`);
    ts.forEachChild(sourceFile, (node) => visitNode(node, sourceFile));
  } else {
    console.error(`Could not find source file: ${filePath}`);
    console.log("Program:", program);
  }
}

function analyzeDirectory(dirPath: string) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      analyzeDirectory(filePath);
    } else if (
      stats.isFile() &&
      (file.endsWith(".ts") || file.endsWith(".tsx"))
    ) {
      analyzeFile(filePath);
    }
  }
}

// Resolve the path and analyze the 'src' directory
const srcPath = path.resolve(__dirname, "../app/src");
analyzeDirectory(srcPath);
