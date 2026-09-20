import fs from "node:fs";
import path from "node:path";

import { inspectBrowserGraph } from "./package/browser_graph.mjs";
import { checkPackagePair, readPackagePair } from "./package/pair.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--artifacts"))
  throw new Error("usage: package-check.mjs [--artifacts <directory>]");
const pair = args.length === 0 ? undefined : await readPackagePair(args[1]);
await checkPackagePair(repositoryRoot, pair);
const packageJson = JSON.parse(
  await fs.promises.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
);
const required = [
  "name",
  "version",
  "license",
  "repository",
  "exports",
  "bin",
  "files",
];
for (const field of required) {
  if (packageJson[field] === undefined)
    throw new Error(`package.json is missing ${field}`);
}
if (
  packageJson.name !== "@mokly/mokly" ||
  packageJson.bin?.mokly !== "./dist/cli/bin.js"
) {
  throw new Error("package identity or executable is invalid");
}
const bin = await fs.promises.readFile(
  path.join(repositoryRoot, "dist/cli/bin.js"),
  "utf8",
);
if (!bin.startsWith("#!/usr/bin/env node"))
  throw new Error("built executable lost its shebang");

const inspector = await fs.promises.readFile(
  path.join(repositoryRoot, "packages/viewer/dist/browser/inspector.js"),
);
if (inspector.length > 9216)
  throw new Error(
    `Inspector exceeds 9,216-byte budget: ${inspector.length} bytes`,
  );

const viewer = JSON.parse(
  await fs.promises.readFile(
    path.join(repositoryRoot, "packages/viewer/package.json"),
    "utf8",
  ),
);
if (packageJson.dependencies["@mokly/viewer"] !== viewer.version)
  throw new Error("CLI must depend on the exact viewer version");
if (
  JSON.stringify(packageJson.workspaces) !== '["packages/viewer"]' ||
  viewer.license !== "MIT" ||
  viewer.type !== "module"
)
  throw new Error("Invalid viewer workspace");
if (
  JSON.stringify(viewer.exports?.["./browser"]) !==
  '{"types":"./dist/browser.d.ts","import":"./dist/browser.js"}'
)
  throw new Error("Viewer browser entry is missing");
const scannedViewerFiles = new Set();
for (const file of await fs.promises.readdir(
  path.join(repositoryRoot, "packages/viewer/dist"),
  { recursive: true },
)) {
  const normalized = file.split(path.sep).join("/");
  if (
    !normalized.endsWith(".js") ||
    normalized === "server.js" ||
    normalized === "viewer/server.js" ||
    normalized === "shell/document.js"
  )
    continue;
  scannedViewerFiles.add(normalized);
  const source = await fs.promises.readFile(
    path.join(repositoryRoot, "packages/viewer/dist", file),
    "utf8",
  );
  if (/(?:from\s*|import\s*\(\s*)["'](?:node:|@mokly\/mokly)/.test(source))
    throw new Error(`Viewer has a forbidden dependency: ${file}`);
}
for (const file of ["browser.js", "browser/react-shell.js"])
  if (!scannedViewerFiles.has(file))
    throw new Error(`Viewer browser scan missed ${file}`);

inspectBrowserGraph();
