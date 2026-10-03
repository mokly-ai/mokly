import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { viewRoute } from "../packages/viewer/dist/data.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { compareStylesheetSources } from "./helpers/component_stylesheet_comparison.js";
import { fixtureWithSheets } from "./helpers/component_stylesheet_fixture.js";
import { componentVariants } from "./helpers/component_views.js";
import { removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

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
  const action = componentVariants(after.manifest, "action")[0]!;
  const actionView = action.componentViews[0]!;
  const html = textOutput(
    after.outputs,
    viewRoute("component", action.id, "mobile", "light"),
  )!;
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

test("declaring already-configured CSS adds no Changes reason", async (context) => {
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
    [],
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
    textOutput(
      result.outputs,
      viewRoute(screen.kind, screen.id, "mobile", "light"),
    )!,
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
    textOutput(
      result.outputs,
      viewRoute(screen.kind, screen.id, "mobile", "light"),
    )!,
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
  const html = textOutput(
    result.outputs,
    viewRoute(screen.kind, screen.id, "mobile", "light"),
  )!;
  assert.match(html, /<meta name="shifted">/);
  assert.doesNotMatch(html, /data-mokly-component-stylesheet/);
  assert.equal(screen.componentViews![0]!.insertedStylesheets?.length, 2);
  for (const span of screen.componentViews![0]!.insertedStylesheets ?? [])
    assert.match(
      html.slice(span.startOffset, span.endOffset),
      /<link\b[^>]*\.css/,
    );
});
