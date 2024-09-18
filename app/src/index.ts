import { Hono } from "hono";

const app = new Hono();

const PASSPHRASES = ["I am a cat", "I am a dog", "I am a bird"];

app.get("/", (c) => {
  const auth = c.req.header("Authorization");
  if (auth && PASSPHRASES.includes(auth)) {
    return c.text("Hello Hono!");
  }
  return c.text("Unauthorized", 401);
});

export default app;
