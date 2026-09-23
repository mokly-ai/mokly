import assert from "node:assert/strict";
import test from "node:test";

import { designLibraryFixture } from "./helpers/design_library_fixture.js";

test("real implementation and saved metadata edits have distinct impact", async (t) => {
  const fixture = await designLibraryFixture(t);
  for (const [file, from, to, id, affects] of [
    [
      "chrome/top-bar.view.tsx",
      'className="mbk-topbar"',
      'className="mbk-topbar revised"',
      "top-bar",
      true,
    ],
    [
      "controls/tag-chip.view.tsx",
      "{label}",
      "{label} revised",
      "tag-chip",
      true,
    ],
    [
      "chrome/top-bar.tsx",
      'title: "Search"',
      'title: "Filtered search"',
      "top-bar",
      false,
    ],
    [
      "chrome/top-bar.tsx",
      'label: "Query"',
      'label: "Search text"',
      "top-bar",
      false,
    ],
    [
      "chrome/top-bar.tsx",
      'query: "tag:forms"',
      'query: "tag:onboarding"',
      "top-bar",
      false,
    ],
  ] as const)
    await t.test(`${file}: ${from}`, async () => {
      await fixture.reset();
      await fixture.edit(
        `examples/basic/entries/design/library/${file}`,
        (source) => source.replace(from, to),
      );
      const after = await fixture.build();
      const result = await fixture.compare(after);
      assert.deepEqual(
        result.changes.map((change) => (change.after ?? change.before)!.id),
        [`design-ui-${id}`],
      );
      assert.equal(result.affectedConsumers.length > 0, affects);
    });
});
