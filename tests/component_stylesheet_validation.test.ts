import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { componentStylesheets } from "../dist/index.js";

import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";

test("a marker from a separately bundled config places links and retains its singleton identity", async (t) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'stylesheets: [{ match: "**", stylesheets: ["base.css", componentStylesheets], lightStylesheets: ["light.css"] }],',
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "light.css"),
    "body{color:black}",
  );
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      "{ defineConfig }",
      "{ defineConfig, componentStylesheets }",
    ),
  );
  const config = await loadConfig(fixture.root);
  assert.equal(
    componentStylesheets,
    Symbol.for("@mokly/mokly/componentStylesheets"),
  );
  assert.equal(config.stylesheets[0]!.componentPosition, 1);
  assert.doesNotThrow(() => structuredClone(config));
  const { manifest, outputs } = await compileCatalogue(config);
  const screen = manifest.entries.find((entry) => entry.id === "home")!;
  assert.equal(screen.kind, "screen");
  if (screen.kind !== "screen") return;
  const html = outputs.get(screen.fragments.mobile)!;
  assert.deepEqual(
    [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(
      (match) => match[1],
    ),
    ["../base.css", "../pane.css", "../action.css", "../light.css"],
  );
});

test("realpath aliases deduplicate declarations and reuse configured links", async (t) => {
  const fixture = await fixtureWithSheets(declared());
  t.after(() => removeFixture(fixture));
  await fs.symlink("action.css", path.join(fixture.mockupsDir, "alias.css"));
  await fs.writeFile(
    fixture.entryPath,
    declared().replace(
      'stylesheets: ["action.css"]',
      'stylesheets: ["action.css", "alias.css"]',
    ),
  );
  const deduplicated = await compileCatalogue(await loadConfig(fixture.root));
  const first = deduplicated.manifest.entries.find(
    (entry) => entry.id === "home",
  );
  assert.ok(first?.kind === "screen");
  assert.equal(
    (
      deduplicated.outputs
        .get(first.fragments.mobile)!
        .match(/href="\.\.\/action\.css"/g) ?? []
    ).length,
    1,
  );
  await fs.writeFile(fixture.entryPath, declared());
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      '"base.css"',
      '"alias.css"',
    ),
  );
  const reused = await compileCatalogue(await loadConfig(fixture.root));
  const screen = reused.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  assert.equal(
    (
      reused.outputs
        .get(screen.fragments.mobile)!
        .match(/href="\.\.\/alias\.css"/g) ?? []
    ).length,
    1,
  );
  assert.deepEqual(
    screen.componentViews![0]!.resources.find(
      (resource) => resource.path === "alias.css",
    )?.componentIds,
    ["action"],
  );
});

test("renderer resource aliases cannot override declared owners", async (t) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'renderer: "renderer.tsx",',
  );
  t.after(() => removeFixture(fixture));
  await fs.symlink("action.css", path.join(fixture.mockupsDir, "alias.css"));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => ({ html: '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources: [{path: "alias.css", componentIds: ["action"]}] });`,
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const screen = result.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  assert.deepEqual(
    screen.componentViews![0]!.resources.find(
      (resource) => resource.path === "action.css",
    )?.componentIds,
    ["action"],
  );
  assert.ok(
    result.warnings?.some((warning) => warning.message.includes("alias.css")),
  );
});

test("an excluded renderer alias cannot bypass public-file protection", async (context) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'renderer: "renderer.tsx", publicExclude: ["private.css"],',
  );
  context.after(() => removeFixture(fixture));
  await fs.symlink("action.css", path.join(fixture.mockupsDir, "private.css"));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => ({ html: '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources: [{path: "private.css", componentIds: ["action"]}] });`,
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /not a public file.*private\.css/,
  );
});
