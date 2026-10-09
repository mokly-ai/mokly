import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { insertComponentStylesheets } from "../dist/components/stylesheet_links.js";
import { loadConfig } from "../dist/config/load.js";
import { parseHtmlLinks } from "../dist/html_links.js";
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
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => '<html><head><meta name="last"></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const screen = result.manifest.entries.find((entry) => entry.path === "home");
  assert.ok(screen?.kind === "screen");
  const html = textOutput(
    result.outputs,
    viewRoute(screen.path, "mobile", "light"),
  )!;
  assert.doesNotMatch(html, /href="\.\.\/\.\.\/base\.css"/);
  assert.match(
    html,
    /<meta name="last"><link rel="stylesheet" href="\.\.\/\.\.\/pane\.css"><link rel="stylesheet" href="\.\.\/\.\.\/action\.css"><\/head><body>/,
  );
});

test("a configured link away from the insertion position may be absent", () => {
  const html = insertComponentStylesheets(
    '<html><head><link rel="stylesheet" href="b.css"><link rel="stylesheet" href="c.css"></head><body></body></html>',
    "mokly-generated/home/index.html",
    ["a.css", "b.css", "c.css"],
    2,
    ["action.css"],
  );
  assert.match(
    html,
    /href="b\.css"><link rel="stylesheet" href="\.\.\/\.\.\/action\.css"><link rel="stylesheet" href="c\.css"/,
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
  ["outside head", '<link rel="stylesheet" href="${input.stylesheets[0]}">'],
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
    const prefix =
      name === "outside head"
        ? `<html><head></head><body>${head}`
        : `<html><head>${head}</head><body>`;
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => \`${prefix}\${renderToStaticMarkup(input.node)}</body></html>\`;`,
    );
    const result = await compileCatalogue(await loadConfig(fixture.root));
    const screen = result.manifest.entries.find(
      (entry) => entry.path === "home",
    );
    assert.ok(screen?.kind === "screen");
    const html = textOutput(
      result.outputs,
      viewRoute(screen.path, "mobile", "light"),
    )!;
    const links = parseHtmlLinks(html).links.map((link) => [
      link.scope,
      link.attributes.get("href"),
    ]);
    const componentLinks = [
      ["head", "../../pane.css"],
      ["head", "../../action.css"],
    ];
    assert.deepEqual(
      links,
      name === "duplicate"
        ? [
            ["head", "../../base.css"],
            ...componentLinks,
            ["head", "../../base.css"],
          ]
        : name === "out of order"
          ? [
              ["head", "../../extra.css"],
              ...componentLinks,
              ["head", "../../base.css"],
            ]
          : [...componentLinks, ["body", "../../base.css"]],
    );
  });
