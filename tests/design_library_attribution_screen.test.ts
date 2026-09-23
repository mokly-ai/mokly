import assert from "node:assert/strict";
import test from "node:test";

import { designLibraryFixture } from "./helpers/design_library_fixture.js";

test("real screen inputs, destinations, slots and ordered instances remain screen-owned", async (t) => {
  const fixture = await designLibraryFixture(t);
  const file = "examples/basic/entries/design/browse/views/use-case.tsx";
  for (const [label, change] of [
    [
      "title",
      (source: string) =>
        source.replace('title="Example tour"', 'title="Explore the example"'),
    ],
    [
      "destination",
      (source: string) =>
        source.replace(
          "screenId={DESTINATIONS.welcome}",
          "screenId={DESTINATIONS.details}",
        ),
    ],
    [
      "slot",
      (source: string) =>
        source.replace(
          "<MiniWelcome />",
          "<MiniWelcome /><p>Continue when ready</p>",
        ),
    ],
    [
      "reorder",
      (source: string) =>
        source.replace(
          /(<FlowStep[\s\S]*?<\/FlowStep>)\s*(<FlowStep[\s\S]*?<\/FlowStep>)/,
          "$2\n$1",
        ),
    ],
    [
      "removal",
      (source: string) => source.replace(/<FlowStep[\s\S]*?<\/FlowStep>/, ""),
    ],
  ] as const)
    await t.test(label, async () => {
      await fixture.reset();
      await fixture.edit(file, change);
      const after = await fixture.build();
      const result = await fixture.compare(after);
      assert.deepEqual(
        result.changes.map((change) => (change.after ?? change.before)!.id),
        ["design-browse-use-case"],
      );
      assert.deepEqual(result.affectedConsumers, []);
    });
});
