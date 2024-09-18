import { spawn } from "node:child_process";
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';


export function getTSServer(pathToProject: string) {
  // Spawn the TypeScript Language Server using 'npx'
  const tsServer = spawn("npx", ["typescript-language-server", "--stdio"]);

  const connection = createMessageConnection(
    new StreamMessageReader(tsServer.stdout),
    new StreamMessageWriter(tsServer.stdin)
  );

  // Handle the server's output (stdout)
  tsServer.stdout.on("data", (data) => {
    console.log(`tsServer output: ${data}`);
  });

  // Handle errors (stderr)
  tsServer.stderr.on("data", (data) => {
    console.error(`tsServer error: ${data}`);
  });

  // Handle when the server closes
  tsServer.on("close", (code) => {
    console.log(`tsServer process exited with code ${code}`);
  });

  // Initialize the server
  connection.sendRequest('initialize', {
    processId: process.pid,
    rootUri: `file://${pathToProject}`,
    capabilities: {},
  }).then(response => {
    console.log('Initialized:', response);
  });

  // Example of sending a message to the server (JSON-RPC request)
  // const initializeRequest = JSON.stringify({
  //   jsonrpc: "2.0",
  //   id: 1,
  //   method: "initialize",
  //   params: {
  //     rootUri: "file:///path/to/your/project",
  //     capabilities: {},
  //   },
  // });

  // Write the initialize request to the stdin of the server
  // tsServer.stdin.write(`${initializeRequest}\n`);
  return connection;
}
