import assert from "node:assert/strict";
import test from "node:test";

import { projectCatalogue } from "../dist/catalogue/projection.js";
import { readCatalogue } from "../packages/viewer/dist/index.js";
import { createCatalogue } from "../packages/viewer/dist/server.js";

import { cssMembershipFixture } from "./helpers/css_membership_fixture.js";

test("catalogue v4 carries comparison rule evidence on screen and saved component views", async (t) => {
  const { result, after } = await cssMembershipFixture(t, {
    before: ".action{color:red}",
    after: ".action{color:blue}",
  });
  const input = {
    configPath: "mokly.config.ts",
    catalogue: createCatalogue(after.manifest),
    changesStatus: "ready" as const,
    comparison: result,
    comparisonUrl: null,
    revision: { content: 0, evidence: 0 },
  };
  const model = projectCatalogue(input);
  assert.deepEqual(model.screens[0]!.views[0]!.resourceEvidence, {
    reasons: result.screens[0]!.views[0]!.reasons,
  });
  const variant = model.components.find(
    (entry) => entry.id === "action-default",
  )!;
  assert.ok("views" in variant);
  assert.deepEqual(variant.views[0]!.resourceEvidence, {
    reasons: result.components[0]!.variants[0]!.views[0]!.reasons,
  });
  assert.deepEqual(readCatalogue(model), model);
  for (const changesStatus of ["pending", "unavailable", "disabled"] as const) {
    const pending = projectCatalogue({ ...input, changesStatus });
    assert.ok(
      pending.screens.every((screen) =>
        screen.views.every((view) => !view.resourceEvidence),
      ),
    );
    const invalid = structuredClone(pending);
    Object.assign(invalid.screens[0]!.views[0]!, {
      resourceEvidence: model.screens[0]!.views[0]!.resourceEvidence,
    });
    assert.throws(() => readCatalogue(invalid), /evidence|ready/);
  }
  const malformed = structuredClone(model);
  Object.assign(malformed.screens[0]!.views[0]!, {
    resourceEvidence: { reasons: [] },
  });
  assert.throws(() => readCatalogue(malformed), /empty/);
});
