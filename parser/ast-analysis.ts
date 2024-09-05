import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

function visitNode(node: ts.Node, sourceFile: ts.SourceFile) {
	console.log(`Node kind: ${ts.SyntaxKind[node.kind]}`);
	console.log(`Node text: ${node.getText(sourceFile)}`);
	console.log(
		`Line number: ${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
	);
	console.log("---");

	ts.forEachChild(node, (child) => visitNode(child, sourceFile));
}

function analyzeFile(filePath: string) {
	const program = ts.createProgram([filePath], {});
	const sourceFile = program.getSourceFile(filePath);

	if (sourceFile) {
		console.log(`Analyzing file: ${filePath}`);
		visitNode(sourceFile, sourceFile);
	} else {
		console.error(`Could not find source file: ${filePath}`);
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

// Analyze the 'src' directory
analyzeDirectory("src");
