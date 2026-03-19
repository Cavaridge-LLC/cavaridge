import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import { execSync } from "child_process";

// Bundle all deps — only externalize modules with known bundling issues
const noBundleList = ["pino", "pino-pretty"];

async function buildAll() {
  console.log("bumping version...");
  execSync("node scripts/bump-version.js", { stdio: "inherit" });

  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => noBundleList.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    banner: {
      js: 'var _importMetaUrl=require("url").pathToFileURL(__filename).href;',
    },
    define: {
      "process.env.NODE_ENV": '"production"',
      "import.meta.url": "_importMetaUrl",
      "import.meta.dirname": "__dirname",
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
