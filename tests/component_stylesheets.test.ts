import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { insertComponentStylesheets } from "../dist/components/stylesheet_links.js";
import { loadConfig } from "../dist/config/load.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";
import { watchTargets } from "../dist/server/watch_paths.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";

test("rendered components link their files in first-render order and own only their linked files", async (t) => {
  const fixture = await fixtureWithSheets();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const { manifest, outputs } = compilation;
  const screen = manifest.entries.find((entry) => entry.id === "home")!;
  assert.equal(screen.kind, "screen");
  if (screen.kind !== "screen") return;
  const html = outputs.get(screen.fragments.mobile)!;
  assert.deepEqual(
    [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(
      (match) => match[1],
    ),
    ["../base.css", "../pane.css", "../action.css"],
  );
  assert.deepEqual(screen.componentViews![0]!.resources, [
    { path: "action.css", componentIds: ["action"] },
    { path: "pane.css", componentIds: ["pane"] },
  ]);
  const action = manifest.entries.find((entry) => entry.id === "action")!;
  assert.equal(action.kind, "component");
  if (action.kind !== "component") return;
  const actionHtml = outputs.get(action.variants[0]!.fragments.mobile)!;
  assert.match(actionHtml, /action\.css/);
  assert.doesNotMatch(actionHtml, /pane\.css/);
  assert.deepEqual(action.variants[0]!.componentViews[0]!.resources, [
    { path: "action.css", componentIds: ["action"] },
  ]);
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
      'id: "action",',
      'id: "action", stylesheets: ["action.css"],',
    ),
    "stylesheets: [],",
  );
  t.after(() => removeFixture(fixture));
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const action = result.manifest.entries.find(
    (entry) => entry.id === "action",
  )!;
  assert.equal(action.kind, "component");
  if (action.kind !== "component") return;
  const html = result.outputs.get(action.variants[0]!.fragments.mobile)!;
  assert.match(
    html,
    /<link rel="stylesheet" href="\.\.\/\.\.\/action\.css"><\/head>/,
  );
  assert.deepEqual(action.variants[0]!.componentViews[0]!.resources, [
    { path: "action.css", componentIds: ["action"] },
  ]);
  const screen = result.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  const screenHtml = result.outputs.get(screen.fragments.mobile)!;
  assert.match(screenHtml, /href="\.\.\/action\.css"/);
  assert.doesNotMatch(screenHtml, /<button/);
});

test("shared declarations merge owners and encode public hrefs without doubling links", async (t) => {
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
  const screen = manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  const html = outputs.get(screen.fragments.mobile)!;
  assert.equal(
    [...html.matchAll(/href="\.\.\/shared%20%26%20encoded\.css"/g)].length,
    1,
  );
  assert.deepEqual(screen.componentViews![0]!.resources, [
    { path: file, componentIds: ["action", "pane"] },
  ]);
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
  const screen = manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  const html = outputs.get(screen.fragments.mobile)!;
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
  [
    "duplicate declaration",
    declared().replace(
      'stylesheets: ["action.css"]',
      'stylesheets: ["action.css", "action.css"]',
    ),
    undefined,
    /duplicate.*action\.css/i,
  ],
  [
    "configured and declared",
    declared(),
    'stylesheets: [{ match: "**", stylesheets: ["action.css"] }],',
    /action\.css.*configured|configured.*action\.css/i,
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

test("renderer cannot report ownership for a declared stylesheet", async (t) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'renderer: "renderer.tsx",',
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => ({html: '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources: [{path: "action.css", componentIds: ["action"]}]});`,
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /action\.css/,
  );
});

for (const value of [
  "[componentStylesheets, componentStylesheets]",
  "[], lightStylesheets: [componentStylesheets]",
])
  test(`rejects invalid configured marker ${value}`, async (t) => {
    const fixture = await fixtureWithSheets(
      declared(),
      `stylesheets: [{ match: "**", stylesheets: ${value} }],`,
    );
    t.after(() => removeFixture(fixture));
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        "{ defineConfig }",
        "{ defineConfig, componentStylesheets }",
      ),
    );
    await assert.rejects(
      loadConfig(fixture.root),
      /componentStylesheets|marker/,
    );
  });

test("missing configured link fails instead of silently appending component links", async (t) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'renderer: "renderer.tsx", stylesheets: [{ match: "**", stylesheets: ["base.css"] }],',
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /base\.css/,
  );
});

test("a configured link away from the insertion position must still be present", () => {
  assert.throws(
    () =>
      insertComponentStylesheets(
        '<html><head><link rel="stylesheet" href="b.css"><link rel="stylesheet" href="c.css"></head><body></body></html>',
        "screens/home.html",
        ["a.css", "b.css", "c.css"],
        2,
        ["action.css"],
      ),
    (error: Error & { code?: string }) =>
      error.code === "build-invalid" && error.message.includes("a.css"),
  );
});

for (const [name, head, pattern] of [
  [
    "duplicate",
    '<link rel="stylesheet" href="${input.stylesheets[0]}"><link rel="stylesheet" href="${input.stylesheets[0]}">',
    /ambiguous.*base\.css/,
  ],
  [
    "out of order",
    '<link rel="stylesheet" href="${input.stylesheets[1]}"><link rel="stylesheet" href="${input.stylesheets[0]}">',
    /out of order.*extra\.css/,
  ],
  [
    "outside head",
    '</head><body><link rel="stylesheet" href="${input.stylesheets[0]}">',
    /missing.*base\.css/,
  ],
] as const)
  test(`rejects ${name} configured links when inserting component links`, async (t) => {
    const fixture = await fixtureWithSheets(
      declared(),
      'renderer: "renderer.tsx", stylesheets: [{ match: "**", stylesheets: ["base.css", "extra.css"] }],',
    );
    t.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.mockupsDir, "extra.css"),
      "body{margin:0}",
    );
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => \`<html><head>${head}</head><body>\${renderToStaticMarkup(input.node)}</body></html>\`;`,
    );
    await assert.rejects(
      compileCatalogue(await loadConfig(fixture.root)),
      pattern,
    );
  });
