import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { insertComponentStylesheets } from "../dist/components/stylesheet_links.js";
import { loadConfig } from "../dist/config/load.js";

import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";

const route = "screens/home.html";
const link = (href: string) => `<link rel="stylesheet" href="${href}">`;
const head = (content: string) =>
  `<html><head>${content}</head><body>Content</body></html>`;
const hrefs = (html: string) =>
  [...html.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*>/g)].map(
    (match) => match[1],
  );

for (const [name, configured, position, markup, expected] of [
  [
    "first marker",
    ["a.css", "b.css"],
    0,
    link("a.css") + link("b.css"),
    ["../action.css", "a.css", "b.css"],
  ],
  [
    "middle marker",
    ["a.css", "b.css"],
    1,
    link("a.css") + link("b.css"),
    ["a.css", "../action.css", "b.css"],
  ],
  [
    "default position",
    ["a.css", "b.css"],
    2,
    link("a.css") + link("b.css"),
    ["a.css", "b.css", "../action.css"],
  ],
  [
    "nearest following",
    ["a.css", "b.css", "c.css"],
    2,
    link("a.css") + link("c.css"),
    ["a.css", "../action.css", "c.css"],
  ],
  [
    "nearest preceding",
    ["a.css", "b.css", "c.css"],
    2,
    link("a.css") + link("b.css"),
    ["a.css", "b.css", "../action.css"],
  ],
  [
    "first repeated anchor",
    ["a.css", "b.css"],
    2,
    link("a.css") + link("b.css") + link("b.css"),
    ["a.css", "b.css", "../action.css", "b.css"],
  ],
  [
    "reordered anchors",
    ["a.css", "b.css"],
    1,
    link("b.css") + link("a.css"),
    ["../action.css", "b.css", "a.css"],
  ],
  [
    "no present anchor",
    ["a.css", "b.css"],
    1,
    '<meta name="last">',
    ["../action.css"],
  ],
] as const)
  test(`component placement uses ${name}`, () => {
    assert.deepEqual(
      hrefs(
        insertComponentStylesheets(head(markup), route, configured, position, [
          "action.css",
        ]),
      ),
      expected,
    );
  });

for (const [name, shared, expected] of [
  [
    "first",
    '[componentStylesheets, "base.css"]',
    ["../pane.css", "../action.css", "../base.css"],
  ],
  [
    "middle",
    '["base.css", componentStylesheets, "extra.css"]',
    ["../base.css", "../pane.css", "../action.css", "../extra.css"],
  ],
  [
    "missing",
    '["base.css", "extra.css"]',
    ["../base.css", "../extra.css", "../pane.css", "../action.css"],
  ],
] as const)
  test(`configured marker ${name} places declared CSS`, async (context) => {
    const fixture = await fixtureWithSheets(
      declared(),
      `stylesheets: [{ match: "**", stylesheets: ${shared} }],`,
    );
    context.after(() => removeFixture(fixture));
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        "{ defineConfig }",
        "{ defineConfig, componentStylesheets }",
      ),
    );
    await fs.writeFile(path.join(fixture.mockupsDir, "extra.css"), "body{}");
    const result = await compileCatalogue(await loadConfig(fixture.root));
    const screen = result.manifest.entries.find((entry) => entry.id === "home");
    assert.ok(screen?.kind === "screen");
    assert.deepEqual(
      hrefs(result.outputs.get(screen.fragments.mobile)!),
      expected,
    );
  });

for (const duplicate of ["action.css", "alias.css"])
  test(`duplicate declared real file ${duplicate} links once`, async (context) => {
    const source = declared().replace(
      'stylesheets: ["action.css"]',
      `stylesheets: ["action.css", ${JSON.stringify(duplicate)}]`,
    );
    const fixture = await fixtureWithSheets(source, "stylesheets: [],");
    context.after(() => removeFixture(fixture));
    if (duplicate === "alias.css")
      await fs.symlink("action.css", path.join(fixture.mockupsDir, duplicate));
    const result = await compileCatalogue(await loadConfig(fixture.root));
    const screen = result.manifest.entries.find((entry) => entry.id === "home");
    assert.ok(screen?.kind === "screen");
    const html = result.outputs.get(screen.fragments.mobile)!;
    assert.equal((html.match(/href="\.\.\/action\.css"/g) ?? []).length, 1);
    assert.deepEqual(
      screen.componentViews![0]!.resources.find(
        (item) => item.path === "action.css",
      )?.componentIds,
      ["action"],
    );
  });

test("configured and declared real file keeps the configured link and rendered owners", async (context) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'stylesheets: [{ match: "**", stylesheets: ["action.css"] }],',
  );
  context.after(() => removeFixture(fixture));
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const screen = result.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  const html = result.outputs.get(screen.fragments.mobile)!;
  assert.equal((html.match(/href="\.\.\/action\.css"/g) ?? []).length, 1);
  assert.deepEqual(
    screen.componentViews![0]!.resources.find(
      (item) => item.path === "action.css",
    )?.componentIds,
    ["action"],
  );
});
