import assert from "node:assert/strict";
import test from "node:test";

import {
  assertStyleRoute,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

test("derived style proof never reads a head-only selector URL from the base", async (context) => {
  const fixture = await styleRouteFixture(context);
  for (const [name, before, after] of [
    ["changed raw seeds", "old", "new"],
    ["missing base seed", "new", "new"],
    ["unequal seeds with both resources present", "old", "new"],
  ])
    await context.test(name!, async () => {
      const input = withHeadStyles(
        fixture,
        `<style>.entry::foo(url(../${before}.svg)){color:red}</style>`,
        `<style>.entry::foo(url(../${after}.svg)){color:blue}</style>`,
        "derived",
      );
      const { comparison } = await assertStyleRoute(
        {
          ...input,
          beforeFiles: new Map([
            ...input.beforeFiles,
            ["old.svg", "old"],
            ...(name!.startsWith("unequal")
              ? [["new.svg", "new"] as const]
              : []),
          ]),
          afterFiles: new Map([
            ...input.afterFiles,
            ["old.svg", "old"],
            ["new.svg", "new"],
          ]),
          changedPaths: name === "changed raw seeds" ? ["mockups/new.svg"] : [],
        },
        "complete",
      );
      assert.equal(comparison.view.state, "changed");
      assert.equal(comparison.view.material, true);
      assert.deepEqual(comparison.reasons, [{ kind: "material" }]);
      assert.equal(comparison.view.inlineStyles?.status, "matched");
    });
});
