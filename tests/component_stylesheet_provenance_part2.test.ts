import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { compareReview } from "../dist/review/compare.js";

import {
  assertFastPathEquivalent,
  compilationFiles,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentGit } from "./helpers/component_review_fixture.js";
import { fixtureWithSheets } from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";

test("renderer-authored CSS links remain page comparison material", async (context) => {
  const source = componentEntrySource({
    body: '<action.Component label="Go" />',
  }).replace('path: "action",', 'path: "action", stylesheets: ["action.css"],');
  const fixture = await fixtureWithSheets(
    source,
    'renderer: "renderer.tsx", stylesheets: [],',
  );
  context.after(() => removeFixture(fixture));
  await fs.symlink("action.css", path.join(fixture.mockupsDir, "alias.css"));
  const rendererPath = path.join(fixture.root, "renderer.tsx");
  const renderer = (
    file: string,
  ) => `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<html><head>' + (input.entry.path === "home" ? '<link rel="stylesheet" href="../${file}">' : '') + '</head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`;
  await fs.writeFile(rendererPath, renderer("action.css"));
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await fs.writeFile(rendererPath, renderer("alias.css"));
  const after = await compileCatalogue(config);
  const css = {
    "action.css": ".action{color:red}",
    "alias.css": ".action{color:red}",
  };
  const result = await assertFastPathEquivalent({
    before: before.manifest,
    after: after.manifest,
    beforeFiles: compilationFiles(before, css),
    afterFiles: compilationFiles(after, css),
    changedPaths: [
      "renderer.tsx",
      "mockups/home/index.mobile.html",
      "mockups/home/index.desktop.html",
    ],
    config,
  });
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.path),
    ["home"],
  );
  const screen = after.manifest.entries.find((entry) => entry.path === "home");
  assert.ok(screen?.kind === "screen");
  assert.deepEqual(screen.componentViews![0]!.insertedStylesheets, []);
});

test("ignored renderer ownership cannot turn an unrelated CSS edit into a component change", async (context) => {
  const source = componentEntrySource({
    actionRender:
      '(props) => <button className="action">{props.label}</button>',
    paneRender: "(props) => <section>{props.children}</section>",
    body: '<pane.Component><p className="shared">Screen content</p></pane.Component>',
  }).replace('path: "action",', 'path: "action", stylesheets: ["action.css"],');
  const fixture = await fixtureWithSheets(
    source,
    'renderer: "renderer.tsx", stylesheets: [],',
  );
  context.after(() => removeFixture(fixture));
  const currentCss = ".action{color:red}\n.shared{margin:1px}\n";
  await fs.writeFile(path.join(fixture.mockupsDir, "action.css"), currentCss);
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => { const home = input.entry.path === "home"; const html = '<html><head>' + (home ? '<link rel="stylesheet" href="../action.css">' : '') + '</head><body>' + renderToStaticMarkup(input.node) + '</body></html>'; return home ? { html, resources: [{path: "action.css", componentIds: ["pane"]}] } : { html }; };`,
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  assert.ok(
    compilation.warnings?.some(
      (warning) =>
        warning.code === "ignored-stylesheet-resource-owner" &&
        warning.context[0] === "home/index.mobile.html" &&
        warning.message.includes("action.css"),
    ),
  );
  const home = compilation.manifest.entries.find(
    (entry) => entry.path === "home",
  );
  assert.ok(home?.kind === "screen");
  assert.deepEqual(home.componentViews![0]!.resources, []);
  const baseline = {
    ...compilation,
    outputs: new Map([
      ...compilation.outputs,
      ["action.css", ".action{color:red}\n.shared{margin:0}\n"],
    ]),
  };
  const { result } = await compareReview(
    compilation,
    config,
    componentGit(baseline, ["mockups/action.css"]),
    "main",
  );
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion !== 5) return;
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.path),
    ["home"],
  );
});
