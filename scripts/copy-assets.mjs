/** Build the CLI's private host modules; shared assets belong to @mokly/viewer. */
import fs from "node:fs/promises";
import path from "node:path";

import {
  buildBrowserModules,
  writeBrowserManifest,
} from "../packages/viewer/scripts/browser.mjs";

const root = path.resolve(import.meta.dirname, "..");
const runtime = await fs.readFile(
  path.join(root, "packages/viewer/src/runtime.ts"),
  "utf8",
);
const runtimeExports = new Map();
for (const match of runtime.matchAll(
  /export\s+\{([^}]+)\}\s+from\s+"\.\/(?:client|standalone)\/([^"/]+)\.js"/g,
))
  for (const name of match[1].split(","))
    runtimeExports.set(name.trim(), match[2]);
const target = path.join(root, "dist/browser");
await buildBrowserModules(path.join(root, "src/client"), target, {
  runtimeExports,
});
await writeBrowserManifest(target);
