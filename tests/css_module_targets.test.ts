import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { ModuleBrowserTargets } from "../dist/build/styles/module_targets.js";
import { loadConfig } from "../dist/config/load.js";

import { removeFixture } from "./helpers/fixture.js";
import { entryStyle, styleFixture } from "./helpers/imported_styles_fixture.js";

const fallbacks =
  ".x{width:-webkit-fill-available;width:-moz-available;width:stretch;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);height:100vh;height:100dvh;top:0;right:0;bottom:0;left:0}@media (min-width:600px){.x{color:red}}";

for (const configured of [false, true])
  test(`CSS Modules retain browser fallbacks with ${configured ? "Safari 14 config" : "fixed default"}`, async (context) => {
    const fixture = await styleFixture(fallbacks, { module: true });
    context.after(() => removeFixture(fixture));
    if (configured)
      await fs.writeFile(
        path.join(fixture.root, ".browserslistrc"),
        "Safari 14\n",
      );
    const stylesheet = (
      await compileCatalogue(await loadConfig(fixture.root))
    ).outputs.get(entryStyle) as string;
    for (const declaration of [
      "-webkit-fill-available",
      "-moz-available",
      "width: stretch",
      "-webkit-backdrop-filter",
      "100vh",
      "100dvh",
      "top: 0",
      "right: 0",
      "bottom: 0",
      "left: 0",
    ])
      assert.ok(
        stylesheet.includes(declaration),
        `${declaration}: ${stylesheet}`,
      );
    assert.match(stylesheet, /min-width:\s*600px/);
  });

test("a Browserslist config without a resolvable package fails precisely", async (context) => {
  const fixture = await styleFixture(".x{color:red}", { module: true });
  context.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.root, ".browserslistrc"), "Safari 14\n");
  const config = await loadConfig(fixture.root);
  const targets = new ModuleBrowserTargets(config, {
    resolve: () => undefined,
  });
  assert.throws(
    () => targets.forFile(path.join(fixture.entriesDir, "fixture.module.css")),
    /Browserslist configuration requires the browserslist package.*install browserslist/,
  );
});

test("Browserslist resolves separately for each stylesheet directory", async (context) => {
  const fixture = await styleFixture(".x{color:red}", { module: true });
  context.after(() => removeFixture(fixture));
  const first = path.join(fixture.entriesDir, "first");
  const second = path.join(fixture.entriesDir, "second");
  await fs.mkdir(first);
  await fs.mkdir(second);
  await fs.writeFile(path.join(first, ".browserslistrc"), "Safari 14\n");
  await fs.writeFile(path.join(second, ".browserslistrc"), "Chrome 109\n");
  const targets = new ModuleBrowserTargets(await loadConfig(fixture.root));
  const safari = targets.forFile(path.join(first, "a.module.css"));
  const chrome = targets.forFile(path.join(second, "b.module.css"));
  assert.notDeepEqual(safari, chrome);
  assert.deepEqual(
    safari,
    targets.forFile(path.join(first, "other.module.css")),
  );
});
