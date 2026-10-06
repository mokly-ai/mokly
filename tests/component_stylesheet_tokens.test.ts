import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { comparisonStylesheetMaterial } from "../dist/components/comparison_stylesheets.js";
import { loadConfig } from "../dist/config/load.js";
import { MoklyError } from "../dist/errors.js";
import { viewRoute } from "../packages/viewer/dist/data.js";

import { fixtureWithSheets } from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

for (const [name, transform] of [
  ["stripped", 'replace(/ data-mokly-component-stylesheet="[^"]*"/g, "")'],
  [
    "replaced",
    'replace(/data-mokly-component-stylesheet="[^"]*"/, \'data-mokly-component-stylesheet="999"\')',
  ],
  ["reassigned", 'replace(/href="([^"]*)pane.css"/, \'href="$1action.css"\')'],
  [
    "duplicated",
    'replace(/<link[^>]*data-mokly-component-stylesheet[^>]*>/, "$&$&")',
  ],
] as const)
  test(`compatibility transformer ${name} provenance tokens`, async (t) => {
    const fixture = await fixtureWithSheets(
      undefined,
      'stylesheets: [], compatibility: { transformer: "transform.ts" },',
    );
    t.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.root, "transform.ts"),
      `export default (input) => input.content.${transform};`,
    );
    const config = await loadConfig(fixture.root);
    if (name !== "stripped") {
      await assert.rejects(
        compileCatalogue(config),
        (error: unknown) =>
          error instanceof MoklyError &&
          error.code === "build-invalid" &&
          /ambiguous data-mokly-component-stylesheet token/.test(error.message),
      );
      return;
    }
    const compilation = await compileCatalogue(config);
    const home = compilation.manifest.entries.find(
      (entry) => entry.path === "home",
    );
    assert.ok(home?.kind === "screen");
    const view = home.componentViews![0]!;
    const html = textOutput(
      compilation.outputs,
      viewRoute(home.path, "mobile", "light"),
    )!;
    assert.deepEqual(view.insertedStylesheets, []);
    assert.match(html, /href="\.\.\/pane\.css"/);
    assert.match(html, /href="\.\.\/action\.css"/);
    assert.doesNotMatch(html, /data-mokly-component-stylesheet/);
    assert.equal(comparisonStylesheetMaterial(html, view).html, html);
  });
