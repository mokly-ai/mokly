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
import { compareStylesheetSources } from "./helpers/component_stylesheet_comparison.js";
import { fixtureWithSheets } from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";

test("adding a declared stylesheet changes its component, not its screen consumers", async (context) => {
  const beforeSource = componentEntrySource({
    body: '<action.Component label="Go" />',
    paneRender: "(props) => <section>{props.children}</section>",
  });
  const { after, result } = await compareStylesheetSources(
    context,
    beforeSource,
    beforeSource.replace(
      'id: "action",',
      'id: "action", stylesheets: ["action.css"],',
    ),
  );
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.id),
    ["action"],
  );
  assert.ok(
    result.affectedConsumers.some(
      (item) => item.changedComponentId === "action",
    ),
  );
  assert.ok(
    result.screens
      .find((entry) => entry.id === "home")
      ?.views.every((view) => view.state === "unchanged"),
  );
  const action = after.manifest.entries.find((entry) => entry.id === "action");
  assert.ok(action?.kind === "component");
  const actionView = action.variants[0]!.componentViews[0]!;
  const html = after.outputs.get(action.variants[0]!.fragments.mobile)!;
  assert.equal(actionView.insertedStylesheets?.length, 1);
  const span = actionView.insertedStylesheets![0]!;
  assert.match(html.slice(span.startOffset, span.endOffset), /action\.css/);
  assert.doesNotMatch(html, /data-mokly-component-stylesheet/);
  assert.ok(
    result.components
      .find((entry) => entry.id === "action")
      ?.variants[0]?.views.some((view) => view.material),
  );
});

test("declaring already-configured CSS changes its component through ownership", async (context) => {
  const beforeSource = componentEntrySource({
    body: '<action.Component label="Go" />',
    paneRender: "(props) => <section>{props.children}</section>",
  });
  const { result } = await compareStylesheetSources(
    context,
    beforeSource,
    beforeSource.replace(
      'id: "action",',
      'id: "action", stylesheets: ["action.css"],',
    ),
    'stylesheets: [{ match: "**", stylesheets: ["action.css"] }],',
  );
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.id),
    ["action"],
  );
});

test("a parent starts showing a styled child without changing its screen consumers", async (context) => {
  const beforeSource = componentEntrySource({
    body: "<pane.Component />",
    paneRender: "(props) => <section>{props.children}</section>",
  }).replace('id: "action",', 'id: "action", stylesheets: ["action.css"],');
  const afterSource = beforeSource.replace(
    "(props) => <section>{props.children}</section>",
    '(props) => <section>{props.children}<action.Component label="Inside" /></section>',
  );
  const { result } = await compareStylesheetSources(
    context,
    beforeSource,
    afterSource,
  );
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.id),
    ["pane"],
  );
  assert.ok(
    result.affectedConsumers.some((item) => item.changedComponentId === "pane"),
  );
});

test("renderer-authored provenance attribute is reserved", async (context) => {
  const source = componentEntrySource({
    body: '<action.Component label="Go" />',
  }).replace('id: "action",', 'id: "action", stylesheets: ["action.css"],');
  const fixture = await fixtureWithSheets(
    source,
    'renderer: "renderer.tsx", stylesheets: [],',
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<html><head><link rel="stylesheet" data-mokly-component-stylesheet="0" href="../base.css"></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /data-mokly-component-stylesheet|provenance|reserved/,
  );
});

test("renderer text may mention the reserved attribute without authoring it", async (context) => {
  const source = componentEntrySource({
    body: '<action.Component label="Go" />',
  }).replace('id: "action",', 'id: "action", stylesheets: ["action.css"],');
  const fixture = await fixtureWithSheets(
    source,
    'renderer: "renderer.tsx", stylesheets: [],',
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<html><head></head><body><p>data-mokly-component-stylesheet=</p>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const screen = result.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  assert.match(
    result.outputs.get(screen.fragments.mobile)!,
    /<p>data-mokly-component-stylesheet=<\/p>/,
  );
});

test("compatibility removal of inserted links also removes their derived owners", async (context) => {
  const fixture = await fixtureWithSheets(
    undefined,
    'stylesheets: [], compatibility: { transformer: "transform.ts" },',
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "transform.ts"),
    `export default (input) => input.content.replace(/<link\\b[^>]*data-mokly-component-stylesheet[^>]*>/g, "");`,
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const screen = result.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  assert.deepEqual(screen.componentViews![0]!.resources, []);
  assert.deepEqual(screen.componentViews![0]!.insertedStylesheets, []);
  assert.doesNotMatch(
    result.outputs.get(screen.fragments.mobile)!,
    /action\.css|pane\.css/,
  );
});

test("compatibility placement retains final-document provenance offsets", async (context) => {
  const fixture = await fixtureWithSheets(
    undefined,
    'stylesheets: [], compatibility: { transformer: "transform.ts" },',
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "transform.ts"),
    'export default (input) => input.content.replace("<head>", \'<head><meta name="shifted">\');',
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const screen = result.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  const html = result.outputs.get(screen.fragments.mobile)!;
  assert.match(html, /<meta name="shifted">/);
  assert.doesNotMatch(html, /data-mokly-component-stylesheet/);
  assert.equal(screen.componentViews![0]!.insertedStylesheets?.length, 2);
  for (const span of screen.componentViews![0]!.insertedStylesheets ?? [])
    assert.match(
      html.slice(span.startOffset, span.endOffset),
      /<link\b[^>]*\.css/,
    );
});

test("renderer-authored CSS links remain page comparison material", async (context) => {
  const source = componentEntrySource({
    body: '<action.Component label="Go" />',
  }).replace('id: "action",', 'id: "action", stylesheets: ["action.css"],');
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
export default (input) => '<html><head>' + (input.entry.id === "home" ? '<link rel="stylesheet" href="../${file}">' : '') + '</head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`;
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
      "mockups/screens/home.mobile.html",
      "mockups/screens/home.desktop.html",
    ],
    config,
  });
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.id),
    ["home"],
  );
  const screen = after.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  assert.deepEqual(screen.componentViews![0]!.insertedStylesheets, []);
});

test("ignored renderer ownership cannot turn an unrelated CSS edit into a component change", async (context) => {
  const source = componentEntrySource({
    actionRender:
      '(props) => <button className="action">{props.label}</button>',
    paneRender: "(props) => <section>{props.children}</section>",
    body: '<pane.Component><p className="shared">Screen content</p></pane.Component>',
  }).replace('id: "action",', 'id: "action", stylesheets: ["action.css"],');
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
export default (input) => { const home = input.entry.id === "home"; const html = '<html><head>' + (home ? '<link rel="stylesheet" href="../action.css">' : '') + '</head><body>' + renderToStaticMarkup(input.node) + '</body></html>'; return home ? { html, resources: [{path: "action.css", componentIds: ["pane"]}] } : { html }; };`,
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  assert.ok(
    compilation.warnings?.some(
      (warning) =>
        warning.code === "ignored-declared-resource-owner" &&
        warning.context[0] === "screens/home.mobile.html" &&
        warning.message.includes("action.css"),
    ),
  );
  const home = compilation.manifest.entries.find(
    (entry) => entry.id === "home",
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
    result.changes.map((entry) => entry.after?.id),
    ["home"],
  );
});
