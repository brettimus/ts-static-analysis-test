import path from "node:path";
import util from "node:util";
import { expandFunction } from "./expand-function";
import { getTSServer } from "./tsserver";

const projectRoot = path.resolve(__dirname, "../app");
const srcPath = path.resolve(__dirname, "../app/src");

const functionToLocate = `(c) => {
  const auth = c.req.header("Authorization");
  if (auth && PASSPHRASES.includes(auth)) {
    return c.text("Hello Hono!");
  }
  return c.text("Unauthorized", 401);
}`.trim();

async function main() {
  try {
    // await tsServerTest();
    const result = await expandFunction(projectRoot, srcPath, functionToLocate);
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}

main().catch((error) => {
  console.error("An error occurred:", error);
  process.exit(1);
});

export async function tsServerTest() {
  const connection = await getTSServer(projectRoot);
  // debugger;
  const fileUri = `file://${path.resolve(projectRoot, "src/index.ts")}`;
  console.log("fileUri", fileUri);

  const response = await connection.sendRequest("textDocument/definition", {
    textDocument: { uri: fileUri },
    position: { line: 0, character: 10 },
  });

  console.log("Definition response:", util.inspect(response, { depth: null }));

  const referencesResponse = await connection.sendRequest(
    "textDocument/references",
    {
      textDocument: { uri: fileUri },
      position: { line: 6, character: 13 },
    },
  );

  console.log(
    "References response:",
    util.inspect(referencesResponse, { depth: null }),
  );
}
