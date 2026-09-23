import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  loadBrowserClientModules,
  loadBrowserClientModulesFrom,
} from "../dist/server/client_modules.js";

type BrowserGraphModule = {
  inspectBrowserGraph(): number;
  inspectDeliveredBrowserGraph(modules: ReadonlyMap<string, Buffer>): number;
  sourceImportSpecifiers(code: string, filename?: string): string[];
};

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

test("delivered browser graph resolves every import", async () => {
  assert.ok(
    loadBrowserClientModules().has("appearance-startup.js"),
    "the standalone appearance startup is not delivered",
  );
  const graph = await loadBrowserGraph();
  assert.ok(graph.inspectBrowserGraph() > 0);
});

test("delivered browser graph rejects a missing import target", async () => {
  const graph = await loadBrowserGraph();
  const modules = new Map([
    [
      "/__mokly/client/react-shell.js",
      Buffer.from('const hydrateRoot = true;\nimport "./missing.js";\n'),
    ],
  ]);
  assert.throws(
    () => graph.inspectDeliveredBrowserGraph(modules),
    /Missing delivered module: \/__mokly\/client\/react-shell\.js -> \.\/missing\.js/,
  );
});

test("delivered browser graph confines React to the hydration bundle", async () => {
  const graph = await loadBrowserGraph();
  const modules = new Map([
    [
      "/__mokly/client/react-shell.js",
      Buffer.from("const hydrateRoot = true;\n"),
    ],
    [
      "/__mokly/client/frame_adapter.js",
      Buffer.from("const hydrateRoot = true;\n"),
    ],
  ]);
  assert.throws(
    () => graph.inspectDeliveredBrowserGraph(modules),
    /Unexpected React runtime in \/__mokly\/client\/frame_adapter\.js/,
  );
});

test("delivered graph parser reads every import form", async () => {
  const graph = await loadBrowserGraph();
  assert.deepEqual(
    graph.sourceImportSpecifiers(
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

async function loadBrowserGraph(): Promise<BrowserGraphModule> {
  return import(
    pathToFileURL(path.resolve("scripts/package/browser_graph.mjs")).href
  ) as Promise<BrowserGraphModule>;
}

function writeBrowserManifest(directory: string, modules: readonly string[]) {
  fs.writeFileSync(
    `${directory}.manifest.json`,
    `${JSON.stringify({ schemaVersion: 1, modules })}\n`,
  );
}
