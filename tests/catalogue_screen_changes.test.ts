import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { projectCatalogue } from "../src/catalogue/projection.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

test("screen-only live view states use real material attribution without snapshots", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    (source) =>
      source.replace(
        'id="home-mobile"',
        'id="home-mobile" data-content="changed"',
      ),
    validEntrySource(),
  );
  const evidence = await readCatalogueChanges(
    fixture.config,
    fixture.after.manifest,
    "main",
    fixture.git,
    "a".repeat(40),
  );
  const model = projectCatalogue({
    configPath: "mokly.config.ts",
    catalogue: createCatalogue(fixture.after.manifest),
    changesStatus: "ready",
    evidence,
    comparisonUrl: null,
    revision: { content: 1, evidence: 1 },
  });
  const home = model.screens.find((entry) => entry.id === "home")!;
  assert.deepEqual(home.changes, {
    status: "ready",
    kind: "changed",
    included: true,
  });
  assert.deepEqual(
    home.views.map((view) => view.comparison),
    [
      { status: "ready", kind: "changed", eligible: true },
      { status: "ready", kind: "changed", eligible: true },
      { status: "ready", kind: "unmodified", eligible: false },
      { status: "ready", kind: "unmodified", eligible: false },
    ],
  );
  assert.equal(model.comparisonUrl, null);
});
