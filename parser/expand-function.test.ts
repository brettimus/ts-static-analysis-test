import * as path from "node:path";
import { expandFunction } from "./expand-function";

const functionToLocate = `(c) => {
  const auth = c.req.header("Authorization");
  if (auth && PASSPHRASES.includes(auth)) {
    return c.text("Hello Hono!");
  }
  return c.text("Unauthorized", 401);
}`.trim();

// Resolve the path and analyze the 'src' directory
const projectRoot = path.resolve(__dirname, "../app");
const srcPath = path.resolve(__dirname, "../app/src");

describe("expandFunction", () => {
  it("should return the function location and definitions of identifiers out of scope", async () => {
    const result = await expandFunction(projectRoot, srcPath, functionToLocate);

    expect(result).not.toBeNull();
    expect(result?.file).toBe(path.resolve(srcPath, "index.ts"));
    expect(result?.startLine).toBe(7);
    expect(result?.startColumn).toBe(14);
    expect(result?.endLine).toBe(13);
    expect(result?.endColumn).toBe(2);

    expect(result?.context?.[0]?.definition?.text).toBe(
      '["I am a cat", "I am a dog", "I am a bird"]',
    );
  });
});
