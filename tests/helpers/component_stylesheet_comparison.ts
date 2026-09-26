import fs from "node:fs/promises";
import type { TestContext } from "node:test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { loadConfig } from "../../dist/config/load.js";

import {
  assertFastPathEquivalent,
  compilationFiles,
} from "./component_fast_path.js";
import { fixtureWithSheets } from "./component_stylesheet_fixture.js";
import { removeFixture } from "./fixture.js";

/** Compare two authored catalogues through both classification paths. */
export async function compareStylesheetSources(
  context: TestContext,
  beforeSource: string,
  afterSource: string,
  extraConfig = "stylesheets: [],",
) {
  const fixture = await fixtureWithSheets(beforeSource, extraConfig);
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await fs.writeFile(fixture.entryPath, afterSource);
  const after = await compileCatalogue(config);
  const files = {
    "action.css": ".action{color:red}",
    "pane.css": ".pane{color:blue}",
    "base.css": "body{margin:0}",
  };
  const result = await assertFastPathEquivalent({
    before: before.manifest,
    after: after.manifest,
    beforeFiles: compilationFiles(before, files),
    afterFiles: compilationFiles(after, files),
    changedPaths: [
      "entries/fixture.mockup.tsx",
      ...[...after.outputs]
        .filter(([route, html]) => before.outputs.get(route) !== html)
        .map(([route]) => `mockups/${route}`),
    ],
    config,
  });
  return { after, before, result };
}
