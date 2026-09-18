import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  loadBrowserClientModules,
  loadBrowserClientModulesFrom,
  loadBrowserNavigationModules,
} from "../dist/server/client_modules.js";

const COMMENT = /\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\n]*/g;
const IMPORT = /\b(?:from|import)\s*\(?\s*"([^"]+)"/g;
const DELIVERED_CLIENT_MODULES = [
  "browse.js",
  "browse_controls.js",
  "browse_details.js",
  "browse_evidence.js",
  "browse_fetch.js",
  "browse_frames.js",
  "browse_links.js",
  "browse_navigation.js",
  "browse_navigation_state.js",
  "browse_recovery.js",
  "browse_refresh.js",
  "browse_runtime.js",
  "browse_state.js",
  "browse_update_state.js",
  "browser.js",
  "catalogue_updates.js",
  "clipboard.js",
  "component_controls.js",
  "component_geometry.js",
  "component_highlight.js",
  "component_occlusion.js",
  "component_overlay.js",
  "component_range_nodes.js",
  "control_fields.js",
  "control_surface.js",
  "control_transport.js",
  "control_view_key.js",
  "diff_views.js",
  "diffs.js",
  "document_ranges.js",
  "early_disclosures.js",
  "entry_wording.js",
  "frame_adapter.js",
  "frame_error.js",
  "frame_mount.js",
  "frame_navigation.js",
  "frame_usage.js",
  "inspector.js",
  "inspector_panels.js",
  "inspector_resize.js",
  "inspector_tabs.js",
  "live_updates.js",
  "message_transport.js",
  "navigation-resize.js",
  "navigation.js",
  "post_message_adapter.js",
  "preview_fragment.js",
  "prop_display.js",
  "react-shell.js",
  "same_origin_access.js",
  "same_origin_adapter.js",
  "same_origin_highlight.js",
  "same_origin_mount.js",
  "same_origin_navigation.js",
  "same_origin_pointer.js",
  "search_query.js",
  "services.js",
  "static_delivery.js",
  "style_evidence.js",
  "tag_filter.js",
  "workspace.js",
  "workspace_events.js",
  "workspace_evidence.js",
  "workspace_evidence_data.js",
  "workspace_inspection.js",
  "workspace_loading.js",
  "workspace_preview.js",
  "workspace_props.js",
  "workspace_updates.js",
  "workspace_variants.js",
] as const;

test("browser build enumeration retains every delivery name", () => {
  assert.deepEqual(
    [...loadBrowserClientModules().keys()],
    DELIVERED_CLIENT_MODULES,
  );
});

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

function writeBrowserManifest(directory: string, modules: readonly string[]) {
  fs.writeFileSync(
    `${directory}.manifest.json`,
    `${JSON.stringify({ schemaVersion: 1, modules })}\n`,
  );
}

test("shell partition rejects kept modules importing retired modules", async () => {
  const module = (await import(
    pathToFileURL(path.resolve("scripts/package/browser_graph.mjs")).href
  )) as {
    assertShellPartitionEdge(importer: string, target: string): void;
    sourceImportSpecifiers(code: string): string[];
  };
  assert.throws(
    () =>
      module.assertShellPartitionEdge(
        "/__mokly/client/same_origin_adapter.js",
        "/__mokly/client/component_highlight.js",
      ),
    /Kept shell module imports retired module/,
  );
  assert.doesNotThrow(() =>
    module.assertShellPartitionEdge(
      "/__mokly/client/same_origin_adapter.js",
      "/__mokly/client/same_origin_highlight.js",
    ),
  );
  assert.deepEqual(
    module.sourceImportSpecifiers(
      'import type { One } from "./one.js";\nimport "./side-effect.js";\nexport { two } from "./two.js";\nvoid import("./dynamic.js");\n',
    ),
    ["./one.js", "./side-effect.js", "./two.js", "./dynamic.js"],
  );
});

test("served browser modules import only modules served beside them", () => {
  const served = new Map([
    ["client", loadBrowserClientModules()],
    ["navigation", loadBrowserNavigationModules()],
  ]);
  const inspected: string[] = [];
  for (const [directory, modules] of served) {
    for (const [filename, source] of modules) {
      for (const specifier of importSpecifiers(source.toString("utf8"))) {
        inspected.push(specifier);
        const target = resolveSpecifier(specifier, directory);
        assert.ok(
          target,
          `${directory}/${filename} imports non-relative module ${specifier}`,
        );
        assert.ok(
          served.get(target.directory)?.has(target.filename),
          `${directory}/${filename} imports unserved module ${specifier}`,
        );
      }
    }
  }
  assert.ok(inspected.length > 0, "no browser import specifier was inspected");
  assert.ok(
    inspected.includes("../navigation/logical.js"),
    "no served module still imports across the client and navigation directories",
  );
});

function importSpecifiers(source: string): string[] {
  return [...source.replace(COMMENT, "").matchAll(IMPORT)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

function resolveSpecifier(
  specifier: string,
  directory: string,
): { directory: string; filename: string } | undefined {
  const sibling = /^\.\/([\w.-]+\.js)$/.exec(specifier)?.[1];
  if (sibling !== undefined) return { directory, filename: sibling };
  const across = /^\.\.\/([\w-]+)\/([\w.-]+\.js)$/.exec(specifier);
  const [, acrossDirectory, acrossFilename] = across ?? [];
  if (acrossDirectory !== undefined && acrossFilename !== undefined)
    return { directory: acrossDirectory, filename: acrossFilename };
  return undefined;
}
