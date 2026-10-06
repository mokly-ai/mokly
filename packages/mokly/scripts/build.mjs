/** Build the CLI's private host modules; shared assets belong to @mokly/viewer. */
import fs from "node:fs/promises";
import path from "node:path";

import {
  buildBrowserModules,
  writeBrowserManifest,
} from "../../viewer/scripts/browser.mjs";

import { copyPackageDocs } from "./copy-docs.mjs";

const root = path.resolve(import.meta.dirname, "..");
const viewerRoot = path.resolve(root, "../viewer");
try {
  await fs.access(path.join(viewerRoot, "dist/index.d.ts"));
} catch (cause) {
  throw new Error(
    "Build @mokly/viewer before @mokly/mokly; run npm run build from the workspace root",
    { cause },
  );
}
await copyPackageDocs(path.resolve(root, "../.."), root);
const runtime = await fs.readFile(
  path.join(viewerRoot, "src/runtime.ts"),
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
  viewerBrowserBundle: "react-shell.js",
});
await writeBrowserManifest(target);
