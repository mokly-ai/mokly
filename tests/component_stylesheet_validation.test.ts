import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { componentStylesheets } from "../dist/index.js";
import { viewRoute } from "../packages/viewer/dist/data.js";

import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

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
  const screen = manifest.entries.find((entry) => entry.path === "home")!;
  assert.equal(screen.kind, "screen");
  if (screen.kind !== "screen") return;
  const html = textOutput(outputs, viewRoute(screen.path, "mobile", "light"))!;
  assert.deepEqual(
    [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(
      (match) => match[1],
    ),
    ["../../base.css", "../../pane.css", "../../action.css", "../../light.css"],
  );
});

test("symlinked declarations fail before deduplication and configured aliases are refused", async (t) => {
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
  const config = await loadConfig(fixture.root);
  const declarationError = {
    code: "build-invalid",
    message:
      "[mokly/build-invalid] component action: stylesheet alias.css is not a public file (is a symlink or non-regular file)",
  };
  await assert.rejects(prepareLiveRuntime(config), declarationError);
  await assert.rejects(compileCatalogue(config), declarationError);
  await fs.writeFile(fixture.entryPath, declared());
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      '"base.css"',
      '"alias.css"',
    ),
  );
  await assert.rejects(compileCatalogue(await loadConfig(fixture.root)), {
    code: "build-invalid",
    message:
      "[mokly/build-invalid] action/default/index.html: stylesheet alias.css is a symlink or non-regular file",
  });
});

test("renderer CSS owners are ignored after safety checks and unlinked aliases are refused", async (t) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'renderer: "renderer.tsx",',
  );
  t.after(() => removeFixture(fixture));
  await fs.symlink("action.css", path.join(fixture.mockupsDir, "alias.css"));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => ({ html: '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources: input.entry.path === "home" ? [{path: "action.css", componentIds: ["action"]}] : [] });`,
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const screen = result.manifest.entries.find((entry) => entry.path === "home");
  assert.ok(screen?.kind === "screen");
  assert.deepEqual(
    screen.componentViews![0]!.insertedStylesheets!.find(
      (resource) => resource.path === "action.css",
    )?.componentPaths,
    ["action"],
  );
  assert.ok(
    result.diagnostics?.some((warning) =>
      warning.message.includes("action.css"),
    ),
  );
  const rendererPath = path.join(fixture.root, "renderer.tsx");
  await fs.writeFile(
    rendererPath,
    (await fs.readFile(rendererPath, "utf8")).replace(
      'path: "action.css"',
      'path: "alias.css"',
    ),
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal((error as { code?: string }).code, "build-invalid");
      assert.equal(
        error.message,
        "[mokly/build-invalid] renderer failed for home (mobile, light): [mokly/components] home/index.mobile.html: component resource is not a public file: alias.css (is a symlink or non-regular file)",
      );
      return true;
    },
  );
});

test("a renderer alias outside the catalogue cannot bypass public-file protection", async (context) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'renderer: "renderer.tsx",',
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.entriesDir, "source.css"), ".action{}");
  await fs.symlink(
    "../entries/source.css",
    path.join(fixture.mockupsDir, "private.css"),
  );
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => ({ html: '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources: [{path: "private.css", componentIds: ["action"]}] });`,
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /not a public file.*private\.css/,
  );
});
