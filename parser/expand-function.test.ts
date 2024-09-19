import * as path from "node:path";
import { expandFunction } from "./expand-function";

// Resolve the path and analyze the 'src' directory
const projectRoot = path.resolve(__dirname, "../app");
const srcPath = path.resolve(__dirname, "../app/src");

describe("expandFunction", () => {
  describe("single file", () => {
    it("should return the function location and definition of a constant identifier that is out of scope", async () => {
      const functionWithConstant = `(c) => {
  const auth = c.req.header("Authorization");
  if (auth && PASSPHRASES.includes(auth)) {
    return c.text("Hello Hono!");
  }
  return c.text("Unauthorized", 401);
}`.trim();
      const result = await expandFunction(
        projectRoot,
        srcPath,
        functionWithConstant,
      );

      expect(result).not.toBeNull();
      expect(result?.file).toBe(path.resolve(srcPath, "index.ts"));
      expect(result?.startLine).toBe(7);
      expect(result?.startColumn).toBe(19);
      expect(result?.endLine).toBe(13);
      expect(result?.endColumn).toBe(2);

      expect(result?.context?.[0]?.definition?.text).toBe(
        '["I am a cat", "I am a dog", "I am a bird"]',
      );
    });

    it("should return the function location and definition of a function identifier that is out of scope", async () => {
      const functionWithHelper = `(c) => {
  const shouldSayHello = helperFunction(c.req);
  return c.text(shouldSayHello ? "Hello Helper Function!" : "Helper Function");
}`.trim();
      const result = await expandFunction(
        projectRoot,
        srcPath,
        functionWithHelper,
      );

      expect(result).not.toBeNull();
      expect(result?.file).toBe(path.resolve(srcPath, "index.ts"));
      expect(result?.startLine).toBe(15);
      expect(result?.startColumn).toBe(29);
      expect(result?.endLine).toBe(18);
      expect(result?.endColumn).toBe(2);

      expect(result?.context?.[0]?.definition?.text).toBe(
        `function helperFunction(req: HonoRequest): boolean {
  return req.query("shouldSayHello") === "true";
}`.trim(),
      );
    });
  });
});
