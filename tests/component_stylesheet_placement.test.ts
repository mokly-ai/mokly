import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { insertComponentStylesheets } from "../dist/components/stylesheet_links.js";
import { loadConfig } from "../dist/config/load.js";
import { viewRoute } from "../packages/viewer/dist/data.js";

import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

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

test("missing configured link places component links at the end of the head", async (t) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'renderer: "renderer.tsx", stylesheets: [{ match: "**", stylesheets: ["base.css"] }],',
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const screen = result.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  const html = textOutput(
    result.outputs,
    viewRoute(screen.kind, screen.id, "mobile", "light"),
  )!;
  assert.doesNotMatch(html, /href="\.\.\/base\.css"/);
  assert.match(html, /pane\.css/);
  assert.match(html, /action\.css/);
});

test("a configured link away from the insertion position may be absent", () => {
  const html = insertComponentStylesheets(
    '<html><head><link rel="stylesheet" href="b.css"><link rel="stylesheet" href="c.css"></head><body></body></html>',
    "screens/home.html",
    ["a.css", "b.css", "c.css"],
    2,
    ["action.css"],
  );
  assert.match(
    html,
    /href="b\.css"><link rel="stylesheet" href="\.\.\/action\.css"><link rel="stylesheet" href="c\.css"/,
  );
});

for (const [name, head] of [
  [
    "duplicate",
    '<link rel="stylesheet" href="${input.stylesheets[0]}"><link rel="stylesheet" href="${input.stylesheets[0]}">',
  ],
  [
    "out of order",
    '<link rel="stylesheet" href="${input.stylesheets[1]}"><link rel="stylesheet" href="${input.stylesheets[0]}">',
  ],
  [
    "outside head",
    '</head><body><link rel="stylesheet" href="${input.stylesheets[0]}">',
  ],
] as const)
  test(`keeps ${name} configured links when inserting component links`, async (t) => {
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
    const result = await compileCatalogue(await loadConfig(fixture.root));
    const screen = result.manifest.entries.find((entry) => entry.id === "home");
    assert.ok(screen?.kind === "screen");
    const html = textOutput(
      result.outputs,
      viewRoute(screen.kind, screen.id, "mobile", "light"),
    )!;
    assert.match(html, /href="\.\.\/pane\.css"/);
    assert.match(html, /href="\.\.\/action\.css"/);
    assert.match(html, /href="\.\.\/base\.css"/);
  });
