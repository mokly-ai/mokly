import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";
import { watchTargets } from "../dist/server/watch_paths.js";
import { viewRoute } from "../packages/viewer/dist/data.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { componentVariants } from "./helpers/component_views.js";
import { removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

test("rendered components link their files in first-render order and record only inserted-link provenance", async (t) => {
  const fixture = await fixtureWithSheets();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const { manifest, outputs } = compilation;
  const screen = manifest.entries.find((entry) => entry.path === "home")!;
  assert.equal(screen.kind, "screen");
  if (screen.kind !== "screen") return;
  const html = textOutput(outputs, viewRoute(screen.path, "mobile", "light"))!;
  assert.deepEqual(
    [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(
      (match) => match[1],
    ),
    ["../base.css", "../pane.css", "../action.css"],
  );
  assert.deepEqual(
    screen
      .componentViews![0]!.insertedStylesheets!.map(
        ({ path, componentPaths }) => ({ path, componentPaths }),
      )
      .sort((a, b) => a.path.localeCompare(b.path)),
    [
      { path: "action.css", componentPaths: ["action"] },
      { path: "pane.css", componentPaths: ["pane"] },
    ],
  );
  const action = componentVariants(manifest, "action")[0]!;
  assert.equal(action.kind, "component");
  if (action.kind !== "component") return;
  const actionHtml = textOutput(
    outputs,
    viewRoute(action.path, "mobile", "light"),
  )!;
  assert.match(actionHtml, /action\.css/);
  assert.doesNotMatch(actionHtml, /pane\.css/);
  assert.deepEqual(
    action.componentViews[0]!.insertedStylesheets!.map(
      ({ path, componentPaths }) => ({ path, componentPaths }),
    ),
    [{ path: "action.css", componentPaths: ["action"] }],
  );
  const runtimeConfig = componentRuntime(compilation).config;
  assert.ok(
    watchTargets(runtimeConfig).includes(
      path.join(fixture.mockupsDir, "action.css"),
    ),
  );
  assert.equal(
    classifyWatchPath(
      { path: path.join(fixture.mockupsDir, "action.css"), kind: "change" },
      runtimeConfig,
    ),
    "reload",
  );
});

test("null markup still links the declared root stylesheet without configured links", async (t) => {
  const fixture = await fixtureWithSheets(
    componentEntrySource({ actionRender: "() => null" }).replace(
      'path: "action",',
      'path: "action", stylesheets: ["action.css"],',
    ),
    "stylesheets: [],",
  );
  t.after(() => removeFixture(fixture));
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const action = componentVariants(result.manifest, "action")[0]!;
  assert.equal(action.kind, "component");
  if (action.kind !== "component") return;
  const html = textOutput(
    result.outputs,
    viewRoute(action.path, "mobile", "light"),
  )!;
  assert.match(
    html,
    /<link rel="stylesheet" href="\.\.\/\.\.\/action\.css"><\/head>/,
  );
  assert.deepEqual(
    action.componentViews[0]!.insertedStylesheets!.map(
      ({ path, componentPaths }) => ({ path, componentPaths }),
    ),
    [{ path: "action.css", componentPaths: ["action"] }],
  );
  const screen = result.manifest.entries.find((entry) => entry.path === "home");
  assert.ok(screen?.kind === "screen");
  const screenHtml = textOutput(
    result.outputs,
    viewRoute(screen.path, "mobile", "light"),
  )!;
  assert.match(screenHtml, /href="\.\.\/action\.css"/);
  assert.doesNotMatch(screenHtml, /<button/);
});

test("shared declarations merge declaring ids and encode public hrefs without doubling links", async (t) => {
  const file = "shared & encoded.css";
  const fixture = await fixtureWithSheets(
    declared(file, file),
    "stylesheets: [],",
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, file), ".action{color:red}");
  const { manifest, outputs } = await compileCatalogue(
    await loadConfig(fixture.root),
  );
  const screen = manifest.entries.find((entry) => entry.path === "home");
  assert.ok(screen?.kind === "screen");
  const html = textOutput(outputs, viewRoute(screen.path, "mobile", "light"))!;
  assert.equal(
    [...html.matchAll(/href="\.\.\/shared%20%26%20encoded\.css"/g)].length,
    1,
  );
  assert.deepEqual(
    screen
      .componentViews![0]!.insertedStylesheets!.map(
        ({ path, componentPaths }) => ({ path, componentPaths }),
      )
      .sort((a, b) => a.path.localeCompare(b.path)),
    [{ path: file, componentPaths: ["action", "pane"] }],
  );
});

test("insertion rebases renderer-owned style offsets through the source header", async (t) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'renderer: "renderer.tsx", stylesheets: [{ match: "**", stylesheets: ["base.css"] }],',
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => { const css = '.action{border-radius:12px}'; const html = '<html><head><link rel="stylesheet" href="' + input.stylesheets[0] + '"><style>' + css + '</style></head><body>' + renderToStaticMarkup(input.node) + '</body></html>'; return { html, styles: [{startOffset: html.indexOf(css), endOffset: html.indexOf(css) + css.length, componentIds: ["action"]}] }; };`,
  );
  const { manifest, outputs } = await compileCatalogue(
    await loadConfig(fixture.root),
  );
  const screen = manifest.entries.find((entry) => entry.path === "home");
  assert.ok(screen?.kind === "screen");
  const html = textOutput(outputs, viewRoute(screen.path, "mobile", "light"))!;
  const { startOffset, endOffset } = screen.componentViews![0]!.styles[0]!;
  assert.equal(
    html.slice(startOffset, endOffset),
    ".action{border-radius:12px}",
  );
});

for (const [name, source, rule, pattern] of [
  ["missing file", declared("missing.css"), undefined, /missing\.css/],
  [
    "HTTP stylesheet",
    declared("https://example.test/x.css"),
    undefined,
    /stylesheets.*HTTP|stylesheets.*relative/i,
  ],
] as const)
  test(`rejects ${name}`, async (t) => {
    const fixture = await fixtureWithSheets(source, rule);
    t.after(() => removeFixture(fixture));
    await assert.rejects(
      compileCatalogue(await loadConfig(fixture.root)),
      pattern,
    );
  });

test("renderer ownership for declared CSS is ignored while provenance is retained", async (t) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'renderer: "renderer.tsx",',
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => ({html: '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources: [{path: "action.css", componentIds: ["action"]}]});`,
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const screen = result.manifest.entries.find((entry) => entry.path === "home");
  assert.ok(screen?.kind === "screen");
  assert.deepEqual(
    screen
      .componentViews![0]!.insertedStylesheets!.map(
        ({ path, componentPaths }) => ({ path, componentPaths }),
      )
      .sort((a, b) => a.path.localeCompare(b.path)),
    [
      { path: "action.css", componentPaths: ["action"] },
      { path: "pane.css", componentPaths: ["pane"] },
    ],
  );
  assert.ok(
    result.warnings?.some(
      (warning) => warning.code === "ignored-stylesheet-resource-owner",
    ),
  );
});
