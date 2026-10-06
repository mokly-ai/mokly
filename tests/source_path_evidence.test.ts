import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { compareReview } from "../dist/review/compare.js";
import { computeChangedPaths } from "../dist/server/changed.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentGit } from "./helpers/component_review_fixture.js";
import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

for (const components of [false, true])
  test(`unrendered declared paths add no changes or evidence (components=${components})`, async (t) => {
    const baseSource = components ? componentEntrySource() : validEntrySource();
    const source = baseSource
      .replace('path: "home",', 'path: "home", dependencies: ["notes.md"],')
      .replace(
        'path: "action",',
        'path: "action", ownedDependencies: ["notes.md"],',
      );
    // Keep recorded JSX locations equal while removing only the retired inputs.
    const cleanSource = source.replace(
      /(?:ownedDependencies|dependencies): \["notes\.md"\],/g,
      (field) => " ".repeat(field.length),
    );
    const fixture = await createFixture(cleanSource);
    t.after(() => removeFixture(fixture));
    await fs.writeFile(path.join(fixture.root, "notes.md"), "Before");
    const clean = await compileCatalogue(await loadConfig(fixture.root));
    await fs.writeFile(fixture.entryPath, source);
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        'review: { outDir: ".review" }',
        'review: { outDir: ".review", sharedImpact: ["notes.md"] }',
      ),
    );
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    assert.deepEqual(compilation.outputs, clean.outputs);
    await writeCompilation(compilation, config);
    assert.deepEqual(
      compilation.warnings?.map((warning) => warning.code).sort(),
      components
        ? [
            "removed-dependencies",
            "removed-owned-dependencies",
            "removed-shared-impact",
          ]
        : ["removed-dependencies", "removed-shared-impact"],
    );
    await fs.writeFile(path.join(fixture.root, "notes.md"), "After");
    const current = await compileCatalogue(config);
    assert.deepEqual(current.outputs, compilation.outputs);
    const git = componentGit(compilation, ["notes.md"]);
    const { result } = await compareReview(current, config, git, "main");
    assert.equal(result.schemaVersion, 5);
    assert.equal(Object.hasOwn(result, "sharedImpact"), false);
    assert.ok(
      result.screens.every((screen) => !Object.hasOwn(screen, "sharedImpact")),
    );
    assert.ok(
      result.screens.every((screen) =>
        screen.views.every((view) => !view.reasons && !view.excludedResources),
      ),
    );
    if (result.schemaVersion === 5) {
      assert.deepEqual(result.changes, []);
      assert.ok(
        result.components.every(
          (component) => !Object.hasOwn(component, "sharedImpact"),
        ),
      );
    }
    assert.deepEqual(await computeChangedPaths(config, "main", git), []);
  });
