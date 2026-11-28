import assert from "node:assert/strict";
import test from "node:test";

import {
  contentComponents,
  contentNames,
  contentScreen,
} from "./fixtures/sidecar/story-component-content.js";
import {
  storyMetas,
  storyUseFixture,
  withoutUsageMarkers,
} from "./helpers/story_use_render.js";

const cases = [
  ["installed", ["children-0"], ["Installed"]],
  ["radix", ["children-0"], ["LinkButton"]],
  ["array", ["children-a", "children-b"], ["Count", "Tab-b"]],
  ["text", [], ["StringCase"]],
  ["only", ["children-0"], ["Only", "Tab"]],
  ["content", ["children-a"], ["Tabs", "Tab-a"]],
  ["filter", [], ["Tab-a"]],
  ["clone", ["children-a", "children-0"], ["TabsClone", "Tab-a"]],
  ["recreate", ["children-b"], ["TabsRecreate", "Tab-b"]],
  ["nested", ["item-icon"], ["NestedProp"]],
  ["cycles", ["item-icon"], ["NestedProp"]],
  ["map", ["item-1-value"], ["NestedProp"]],
  ["repeat", ["children-b"], ["Twice", "Tab-b", "Tab-b"]],
  [
    "forward",
    ["children-a", "children-a"],
    ["ForwardContent", "Only", "Tab-a"],
  ],
  ["spread", ["children-With spread"], ["Tabs", "Tab-with-spread"]],
] as const;

for (const vite of [false, true]) {
  test(`${vite ? "Vite" : "esbuild"} keeps React content semantics and records implicit slots`, async (context) => {
    const fixture = await storyUseFixture(context, {
      "content.tsx": contentComponents,
      "screen.mockup.tsx": contentScreen,
      "Installed.stories.tsx": `import { Slottable } from "@radix-ui/react-slot";
        export default { title: "Installed", component: Slottable };
        export const Primary = { render: () => <Slottable><a>Story</a></Slottable> };`,
      ...storyMetas("./content.js", contentNames),
    });
    const plain = await fixture.compile(vite, false);
    const recorded = await fixture.compile(vite);
    for (const [scenario, slots, ids] of cases) {
      const props = { scenario };
      const [original, result] = await Promise.all([
        plain.screen(props),
        recorded.screen(props),
      ]);
      assert.equal(withoutUsageMarkers(result.html), original.html, scenario);
      assert.deepEqual(
        result.slots.map(({ name }) => name),
        slots,
        scenario,
      );
      assert.deepEqual(
        result.instances.map(({ id }) => id),
        ids,
        scenario,
      );
      const placements = result.slots.flatMap(({ regionIds }) => regionIds);
      assert.deepEqual(
        result.markers
          .filter(({ payload }) => payload.kind === "slot")
          .map(({ id }) => id)
          .sort(),
        placements.toSorted(),
        scenario,
      );
      switch (scenario) {
        case "array":
          assert.deepEqual(result.instances[0]?.props.children, [
            "array",
            [["null"], ["string", "Text"], ["null"]],
          ]);
          break;
        case "text":
          assert.deepEqual(result.instances[0]?.props.children, [
            "string",
            "Text",
          ]);
          break;
        case "repeat": {
          const [, first, second] = result.instances;
          assert.equal(first?.key, second?.key);
          assert.notEqual(first?.regionId, second?.regionId);
          assert.deepEqual(result.slots[0]?.regionIds.length, 2);
          break;
        }
        case "forward":
          assert.equal(result.slots[1]?.sourceSlotKey, result.slots[0]?.key);
          assert.equal(result.instances[2]?.slotKey, result.slots[0]?.key);
          assert.deepEqual(result.instances[2]?.owner, { kind: "entry" });
          break;
      }
    }
  });
}
