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
      'path: "action",',
      'path: "action", stylesheets: ["action.css"],',
    ),
  );
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.path),
    ["action"],
  );
  assert.ok(
    result.affectedConsumers.some(
      (item) => item.changedComponentId === "action",
    ),
  );
  assert.ok(
    result.screens
      .find((entry) => entry.path === "home")
      ?.views.every((view) => view.state === "unchanged"),
  );
  const action = componentVariants(after.manifest, "action")[0]!;
  const actionView = action.componentViews[0]!;
  const html = textOutput(
    after.outputs,
    viewRoute(action.path, "mobile", "light"),
  )!;
  assert.equal(actionView.insertedStylesheets?.length, 1);
  const span = actionView.insertedStylesheets![0]!;
  assert.match(html.slice(span.startOffset, span.endOffset), /action\.css/);
  assert.doesNotMatch(html, /data-mokly-component-stylesheet/);
  assert.ok(
    result.components
      .find((entry) => entry.path === "action")
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
      'path: "action",',
      'path: "action", stylesheets: ["action.css"],',
    ),
    'stylesheets: [{ match: "**", stylesheets: ["action.css"] }],',
  );
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.path),
    [],
  );
});

test("a parent starts showing a styled child without changing its screen consumers", async (context) => {
  const beforeSource = componentEntrySource({
    body: "<pane.Component />",
    paneRender: "(props) => <section>{props.children}</section>",
  }).replace('path: "action",', 'path: "action", stylesheets: ["action.css"],');
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
    result.changes.map((entry) => entry.after?.path),
    ["pane"],
  );
  assert.ok(
    result.affectedConsumers.some((item) => item.changedComponentId === "pane"),
  );
});

test("renderer text may mention the reserved attribute without authoring it", async (context) => {
  const source = componentEntrySource({
    body: '<action.Component label="Go" />',
  }).replace('path: "action",', 'path: "action", stylesheets: ["action.css"],');
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
  const screen = result.manifest.entries.find((entry) => entry.path === "home");
  assert.ok(screen?.kind === "screen");
  assert.match(
    textOutput(result.outputs, viewRoute(screen.path, "mobile", "light"))!,
    /<p>data-mokly-component-stylesheet=<\/p>/,
  );
});
