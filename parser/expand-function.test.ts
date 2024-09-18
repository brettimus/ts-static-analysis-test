import * as path from "node:path";
import { expandFunction } from "./expand-function";

const functionToLocate = `(c) => {
	const auth = c.req.header("Authorization");
	if (auth && PASSPHRASES.includes(auth)) {
		return c.text("Hello Hono!");
	}
	return c.text("Unauthorized", 401);
}`.trim()

// Resolve the path and analyze the 'src' directory
const srcPath = path.resolve(__dirname, "../app/src");
const result = expandFunction(srcPath, functionToLocate);

describe("expandFunction", () => {
	it("should return the function location", () => {
		expect(result).not.toBeNull();
		expect(result?.file).toBe(path.resolve(srcPath, "index.ts"));
		expect(result?.startLine).toBe(11);
		expect(result?.startColumn).toBe(14);
		expect(result?.endLine).toBe(17);
		expect(result?.endColumn).toBe(2);
	});
});