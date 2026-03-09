import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const versionPath = resolve(__dirname, "..", "version.json");

const version = JSON.parse(readFileSync(versionPath, "utf-8"));
const flag = process.argv[2];

if (flag === "--major") {
  version.major += 1;
  version.minor = 0;
  version.patch = 0;
  version.build = 1;
} else if (flag === "--minor") {
  version.minor += 1;
  version.patch = 0;
  version.build = 1;
} else if (flag === "--patch") {
  version.patch += 1;
  version.build = 1;
} else {
  version.build += 1;
}

version.timestamp = new Date().toISOString();

writeFileSync(versionPath, JSON.stringify(version, null, 2) + "\n");

const versionStr = `${version.major}.${version.minor}.${version.patch}`;
console.log(`MERIDIAN v${versionStr} (build ${version.build}) — ${version.timestamp}`);
