import assert from "node:assert/strict";
import test from "node:test";

import {
  assertStyleRoute,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

for (const mode of ["committed", "derived"] as const)
  test(`a dropped raw style reference cannot prove canonical resource safety in ${mode}`, async (context) => {
    const fixture = await styleRouteFixture(context);
    for (const [name, style] of [
      [
        "CSS comment",
        (color: string) =>
          `<style>.entry{background:url("../../asset.svg")}/*<!--mokly-review-ignore:start:clock-->same<!--mokly-review-ignore:end:clock-->*/.actual-only{color:${color}}</style>`,
      ],
      [
        "style tag attributes",
        (color: string) =>
          `<style data-ignore="<!--mokly-review-ignore:start:clock-->">.entry{background:url("../../asset.svg")}</style data-ignore="<!--mokly-review-ignore:end:clock-->"><style>.actual-only{color:${color}}</style>`,
      ],
    ] as const)
      await context.test(name, async () => {
        const input = withHeadStyles(
          fixture,
          style("red"),
          style("blue"),
          mode,
        );
        const { comparison } = await assertStyleRoute(
          {
            ...input,
            beforeFiles: new Map([
              ...input.beforeFiles,
              ["asset.svg", "before"],
            ]),
            afterFiles: new Map([...input.afterFiles, ["asset.svg", "after"]]),
            changedPaths: ["mockups/asset.svg"],
          },
          "complete",
        );
        assert.deepEqual(comparison.view.reasons, [
          { kind: "dependency", path: "mockups/asset.svg" },
        ]);
      });
  });
