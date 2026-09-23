import assert from "node:assert/strict";
import test from "node:test";

import { designLibraryFixture } from "./helpers/design_library_fixture.js";

test("screen query and field values remain direct changes in their owning designs", async (t) => {
  const fixture = await designLibraryFixture(t);
  for (const [file, from, to, expected] of [
    [
      "browse/states/tags/picker.tsx",
      "design={DESTINATIONS.tagPicker}",
      'design={DESTINATIONS.tagPicker} tag="forms"',
      ["design-browse-tag-picker"],
    ],
    [
      "components/controls/parts/fixtures.ts",
      "draft: { ...saved, cornerRadius: 40 }",
      "draft: { ...saved, cornerRadius: 50 }",
      ["design-component-controls-invalid"],
    ],
  ] as const)
    await t.test(file, async () => {
      await fixture.reset();
      await fixture.edit(`examples/basic/entries/design/${file}`, (source) =>
        source.replace(from, to),
      );
      const result = await fixture.compare(await fixture.build());
      assert.deepEqual(
        result.changes.map((change) => (change.after ?? change.before)!.id),
        expected,
      );
      assert.deepEqual(result.affectedConsumers, []);
    });
});
