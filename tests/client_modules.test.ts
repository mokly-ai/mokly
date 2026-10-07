import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadBrowserClientModules,
  loadBrowserClientModulesFrom,
} from "../dist/server/client_modules.js";
import { inspectBrowserGraph } from "../scripts/package/browser_graph.mjs";
import {
  inspectDeliveredBrowserGraph,
  sourceImportSpecifiers,
} from "../scripts/package/browser_graph_analysis.mjs";

test("browser build enumeration reports a missing output directory", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mokly-browser-modules-"));
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const cli = path.join(root, "cli");
  fs.mkdirSync(cli);
  fs.writeFileSync(path.join(cli, "browser.js"), "export {};\n");
  writeBrowserManifest(cli, ["browser.js"]);
  assert.throws(
    () => loadBrowserClientModulesFrom(path.join(root, "missing"), cli),
    /could not enumerate browser client modules|could not read browser build manifest/,
  );
});

test("browser build enumeration reports a missing listed file", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mokly-browser-modules-"));
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const viewer = path.join(root, "viewer");
  const cli = path.join(root, "cli");
  fs.mkdirSync(viewer);
  fs.mkdirSync(cli);
  writeBrowserManifest(viewer, ["missing.js"]);
  writeBrowserManifest(cli, []);
  assert.throws(
    () => loadBrowserClientModulesFrom(viewer, cli),
    /missing browser build output: missing\.js/,
  );
});

test("browser build enumeration rejects unexpected output files", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mokly-browser-modules-"));
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const viewer = path.join(root, "viewer");
  const cli = path.join(root, "cli");
  fs.mkdirSync(viewer);
  fs.mkdirSync(cli);
  fs.writeFileSync(path.join(viewer, "viewer.js"), "export {};\n");
  fs.writeFileSync(path.join(viewer, "viewer.js.map"), "{}");
  fs.writeFileSync(path.join(cli, "browser.js"), "export {};\n");
  writeBrowserManifest(viewer, ["viewer.js"]);
  writeBrowserManifest(cli, ["browser.js"]);
  assert.throws(
    () => loadBrowserClientModulesFrom(viewer, cli),
    /unexpected browser build output: viewer\.js\.map/,
  );
});

test("delivered browser graph resolves every import", () => {
  assert.ok(
    loadBrowserClientModules().has("appearance-startup.js"),
    "the standalone appearance startup is not delivered",
  );
  assert.ok(inspectBrowserGraph() > 0);
});

test("delivered browser graph rejects a missing import target", () => {
  const modules = new Map([
    [
      "/mokly-viewer/client/react-shell.js",
      Buffer.from('const hydrateRoot = true;\nimport "./missing.js";\n'),
    ],
  ]);
  assert.throws(
    () => inspectDeliveredBrowserGraph(modules),
    /Missing delivered module: \/mokly-viewer\/client\/react-shell\.js -> \.\/missing\.js/,
  );
});

test("delivered browser graph confines React to the hydration bundle", () => {
  const modules = new Map([
    [
      "/mokly-viewer/client/react-shell.js",
      Buffer.from("const hydrateRoot = true;\n"),
    ],
    [
      "/mokly-viewer/client/frame_adapter.js",
      Buffer.from("const hydrateRoot = true;\n"),
    ],
  ]);
  assert.throws(
    () => inspectDeliveredBrowserGraph(modules),
    /Unexpected React runtime in \/mokly-viewer\/client\/frame_adapter\.js/,
  );
});

test("delivered graph parser reads every import form", () => {
  assert.deepEqual(
    sourceImportSpecifiers(
      'import type { One } from "./one.js";\nimport "./side-effect.js";\nexport { two } from "./two.js";\nvoid import("./dynamic.js");\ntype Five = import("./import-type.js").Five;\n',
    ),
    [
      "./one.js",
      "./side-effect.js",
      "./two.js",
      "./dynamic.js",
      "./import-type.js",
    ],
  );
});

function writeBrowserManifest(directory: string, modules: readonly string[]) {
  fs.writeFileSync(
    `${directory}.manifest.json`,
    `${JSON.stringify({ schemaVersion: 1, modules })}\n`,
  );
}
