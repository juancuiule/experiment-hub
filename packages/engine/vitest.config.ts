import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["**/*.ts"],
      exclude: ["**/*.test.ts", "**/specs/**", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: [
      // The engine's own specs import through the package's public name.
      // pnpm doesn't self-link a package into itself, so map the name back
      // to the package root for the test run.
      {
        find: /^@experiment-hub\/engine\/(.*)$/,
        replacement: path.resolve(__dirname, "$1"),
      },
    ],
  },
});
