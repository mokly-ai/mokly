import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { insertComponentStylesheets } from "../dist/components/stylesheet_links.js";
import { rendererStylesheetPaths } from "../dist/components/stylesheet_reuse.js";
import { loadConfig } from "../dist/config/load.js";
import { compareReview } from "../dist/review/compare.js";

import { componentGit } from "./helpers/component_review_fixture.js";
import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";

test("realpath aliases share one first-declaration link and both rendered owners", async (context) => {
  const source = declared("action.css", "alias.css")
    .replace(
      '<pane.Component><action.Component label="Go" /></pane.Component><action.Component moklyInstance="hidden" label="Hidden" hidden />',
      '<action.Component label="Go" /><pane.Component />',
    )
    .replace(
      "<button data-viewport=",
      '<button className="action" data-viewport=',
    );
  const fixture = await fixtureWithSheets(source, "stylesheets: [],");
  context.after(() => removeFixture(fixture));
  await fs.symlink("action.css", path.join(fixture.mockupsDir, "alias.css"));
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  const screen = before.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  const html = before.outputs.get(screen.fragments.mobile)!;
  assert.equal((html.match(/href="\.\.\/action\.css"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /href="\.\.\/alias\.css"/);
  assert.deepEqual(screen.componentViews![0]!.resources, [
    { path: "action.css", componentIds: ["action", "pane"] },
  ]);

  const baseline = {
    ...before,
    outputs: new Map([
      ...before.outputs,
      ["action.css", ".action{color:red}"],
      ["alias.css", ".action{color:red}"],
    ]),
  };
  await fs.writeFile(
    path.join(fixture.mockupsDir, "action.css"),
    ".action{color:green}",
  );
  const after = await compileCatalogue(config);
  await writeCompilation(after, config);
  const { result } = await compareReview(
    after,
    config,
    componentGit(baseline, ["mockups/action.css"]),
    "main",
  );
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion !== 5) return;
  assert.deepEqual(result.changes.map((entry) => entry.after?.id).sort(), [
    "action",
    "pane",
  ]);
  assert.ok(
    result.affectedConsumers.some(
      (consumer) => consumer.changedComponentId === "action",
    ),
  );
  assert.ok(
    result.affectedConsumers.some(
      (consumer) => consumer.changedComponentId === "pane",
    ),
  );
});

test("renderer-authored aliases stay in place and select the first link's public ownership path", async (context) => {
  const fixture = await fixtureWithSheets(
    declared("action.css", "alias.css"),
    'renderer: "renderer.tsx", stylesheets: [],',
  );
  context.after(() => removeFixture(fixture));
  await fs.symlink("action.css", path.join(fixture.mockupsDir, "alias.css"));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => { const prefix = input.entry.kind === "component" ? "../../" : "../"; return '<html><head><meta name="first"><link rel="alternate stylesheet" href="' + prefix + 'alias.css"><link rel="stylesheet" href="' + prefix + 'action.css"></head><body>' + renderToStaticMarkup(input.node) + '</body></html>'; };`,
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const screen = result.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  const html = result.outputs.get(screen.fragments.mobile)!;
  assert.equal((html.match(/href="\.\.\/alias\.css"/g) ?? []).length, 1);
  assert.equal((html.match(/href="\.\.\/action\.css"/g) ?? []).length, 1);
  assert.ok(html.indexOf('name="first"') < html.indexOf("alias.css"));
  assert.deepEqual(screen.componentViews![0]!.resources, [
    { path: "alias.css", componentIds: ["action", "pane"] },
  ]);
});

test("dot-prefixed alias filenames inside the public root remain reusable", async (context) => {
  const fixture = await fixtureWithSheets();
  context.after(() => removeFixture(fixture));
  await fs.symlink("action.css", path.join(fixture.mockupsDir, "..alias.css"));
  const physical = await fs.realpath(
    path.join(fixture.mockupsDir, "action.css"),
  );
  assert.equal(
    rendererStylesheetPaths(
      '<html><head><link rel="stylesheet" href="../..alias.css"></head><body></body></html>',
      "screens/home.html",
      fixture.mockupsDir,
      new Set([physical]),
    ).get(physical),
    "..alias.css",
  );
});

test("renderer link query and fragment still identify the same public file", async (context) => {
  const fixture = await fixtureWithSheets();
  context.after(() => removeFixture(fixture));
  const physical = await fs.realpath(
    path.join(fixture.mockupsDir, "action.css"),
  );
  assert.equal(
    rendererStylesheetPaths(
      '<html><head><link rel="stylesheet" href="../action.css?v=1#theme"></head><body></body></html>',
      "screens/home.html",
      fixture.mockupsDir,
      new Set([physical]),
    ).get(physical),
    "action.css",
  );
});

test("renderer input omits declared stylesheets but keeps configured hrefs", async (context) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'renderer: "renderer.tsx", stylesheets: [{ match: "**", stylesheets: ["base.css"] }],',
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<html><head><link rel="stylesheet" href="' + input.stylesheets[0] + '"></head><body data-entry-stylesheets="' + Object.hasOwn(input.entry, "stylesheets") + '">' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  for (const [route, html] of result.outputs) {
    if (!route.endsWith(".html")) continue;
    assert.match(html, /data-entry-stylesheets="false"/, route);
    assert.match(html, /href="[^"]*base\.css"/, route);
  }
});

test("configured alternate stylesheet tokens anchor declared links", () => {
  const html =
    '<html><head><link rel="alternate Stylesheet" href="../base.css"></head><body>Content</body></html>';
  assert.equal(
    insertComponentStylesheets(html, "screens/home.html", ["../base.css"], 1, [
      "action.css",
    ]),
    '<html><head><link rel="alternate Stylesheet" href="../base.css"><link rel="stylesheet" href="../action.css"></head><body>Content</body></html>',
  );
});

test("configured links anchor insertion without an explicit head end tag", () => {
  const html =
    '<html><head><link rel="alternate stylesheet" href="../base.css"><body>Content</body></html>';
  assert.match(
    insertComponentStylesheets(html, "screens/home.html", ["../base.css"], 1, [
      "action.css",
    ]),
    /base\.css"><link rel="stylesheet" href="\.\.\/action\.css"><body>/,
  );
});

for (const [name, html, expected] of [
  [
    "head with elements",
    '<html><head><meta name="last"><body>Content</body></html>',
    '<meta name="last"><link rel="stylesheet" href="../action.css"><body>',
  ],
  [
    "empty head",
    "<html><head><body>Content</body></html>",
    '<head><link rel="stylesheet" href="../action.css"><body>',
  ],
  [
    "implicit head",
    "<html><body>Content</body></html>",
    '<html><link rel="stylesheet" href="../action.css"><body>',
  ],
] as const)
  test(`links before body when ${name} has no closing head tag`, () => {
    assert.match(
      insertComponentStylesheets(html, "screens/home.html", [], 0, [
        "action.css",
      ]),
      new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });
