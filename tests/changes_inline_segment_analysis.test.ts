import assert from "node:assert/strict";
import test from "node:test";

import { inlineChangesFixture } from "./helpers/inline_changes.js";

test("unmatched custom-property reference copy remains material and unresolved", async (context) => {
  const rule = '.missing{--tone:red;background:url("../image.svg")}';
  const fixture = await inlineChangesFixture(
    context,
    `<style>${rule}</style>`,
    `<style>${rule}${rule}</style>`,
    {
      colorSchemes: false,
      files: {
        before: { "image.svg": "same" },
        after: { "image.svg": "same" },
      },
    },
  );
  const { result } = await fixture.complete(false);
  assert.ok(result.schemaVersion === 6);
  const home = result.screens.find((screen) => screen.path === "home");
  assert.ok(home);
  assert.equal(home.views.length, 2);
  for (const view of home.views) {
    assert.equal(view.state, "changed");
    assert.equal(view.material, true);
    assert.deepEqual(view.inlineStyles, {
      status: "unresolved",
      selectors: [".missing"],
    });
    assert.equal(view.excludedResources, undefined);
  }
  assert.ok(
    result.changes
      .find((change) => change.after?.path === "home")
      ?.reasons.some((reason) => reason.kind === "material"),
  );
  assert.deepEqual(
    [
      ...new Set(
        result.affectedConsumers.map((consumer) => consumer.changedComponentId),
      ),
    ].sort(),
    ["action", "pane"],
  );
});
