import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { compareReview } from "../dist/review/compare.js";
import { computeChangedRoutes } from "../dist/server/changed.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentGit } from "./helpers/component_review_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const components of [false, true])
  test(`unrendered declared paths add no changes or evidence (components=${components})`, async (t) => {
    const fixture = await createFixture(
      components ? componentEntrySource() : undefined,
    );
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    await writeCompilation(compilation, config);
    const git = componentGit(compilation, ["notes.md"]);
    const { result } = await compareReview(compilation, config, git, "main");
    assert.equal(result.schemaVersion, components ? 5 : 4);
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
    assert.deepEqual(await computeChangedRoutes(config, "main", git), []);
  });
