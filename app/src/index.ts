import { Hono, type HonoRequest } from "hono";

const app = new Hono();

const PASSPHRASES = ["I am a cat", "I am a dog", "I am a bird"];

app.get("/const", (c) => {
  const auth = c.req.header("Authorization");
  if (auth && PASSPHRASES.includes(auth)) {
    return c.text("Hello Hono!");
  }
  return c.text("Unauthorized", 401);
});

app.get("/helper-function", (c) => {
  const shouldSayHello = helperFunction(c.req);
  return c.text(shouldSayHello ? "Hello Helper Function!" : "Helper Function");
});

export default app;

function helperFunction(req: HonoRequest): boolean {
  return req.query("shouldSayHello") === "true";
}
