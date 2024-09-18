import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Add any Vitest-specific configurations here
    globals: true,
    environment: "node",
  },
});
