import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**"],
      exclude: ["**/*.test.{ts,tsx}", "**/specs/**", "src/debug/**", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: [
      // Resolve the workspace engine package to its TS source so vitest
      // doesn't depend on the package's exports map being honored.
      {
        find: /^@experiment-hub\/engine\/(.*)$/,
        replacement: path.resolve(__dirname, "../../packages/engine/$1"),
      },
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
});
