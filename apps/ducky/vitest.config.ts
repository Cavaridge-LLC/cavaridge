import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: [],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client", "src"),
      "@cavaridge/types": path.resolve(__dirname, "..", "..", "packages", "types", "src"),
      "@cavaridge/auth": path.resolve(__dirname, "..", "..", "packages", "auth", "src"),
      "@cavaridge/config": path.resolve(__dirname, "..", "..", "packages", "config", "src"),
      "@cavaridge/db": path.resolve(__dirname, "..", "..", "packages", "db", "src"),
      "@cavaridge/spaniel": path.resolve(__dirname, "..", "..", "packages", "spaniel", "src"),
      "@cavaridge/security": path.resolve(__dirname, "..", "..", "packages", "security", "src"),
      "@cavaridge/audit": path.resolve(__dirname, "..", "..", "packages", "audit", "src"),
      "@cavaridge/ducky-animations": path.resolve(__dirname, "..", "..", "packages", "ducky-animations", "src"),
    },
  },
});
