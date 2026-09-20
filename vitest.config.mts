import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Default DOM environment for component tests. API route tests opt
    // into the real Node environment individually via a
    // `// @vitest-environment node` docblock, since they exercise
    // Next.js server code (Request/FormData/File from Node's fetch impl).
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
