import { build as esbuild } from "esbuild";
import { rm, cp } from "fs/promises";
import { resolve } from "path";

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building server...");
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    logLevel: "info",
    // Resolve @cavaridge/spr-core from TypeScript source directly.
    // This avoids a separate tsc pre-build step in the Dockerfile —
    // esbuild handles TS natively so no devDeps on spr-core are needed.
    alias: {
      "@cavaridge/spr-core": resolve("../../packages/spr-core/src/index.ts"),
    },
  });

  console.log("copying public assets...");
  await cp("public", "dist/public", { recursive: true });

  console.log("build complete.");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
