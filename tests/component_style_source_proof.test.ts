import assert from "node:assert/strict";
import test from "node:test";

import {
  assertStyleRoute,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

for (const evidenceKind of ["git", "bytes"] as const)
  test(`a dropped raw style reference cannot prove canonical resource safety with ${evidenceKind} evidence`, async (context) => {
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
        const input = withHeadStyles(fixture, style("red"), style("blue"));
        const { comparison } = await assertStyleRoute(
          {
            ...input,
            beforeFiles: new Map([
              ...input.beforeFiles,
              ["asset.svg", "before"],
            ]),
            afterFiles: new Map([...input.afterFiles, ["asset.svg", "after"]]),
            changedPaths: evidenceKind === "git" ? ["mockups/asset.svg"] : [],
          },
          "complete",
        );
        const reason =
          evidenceKind === "git"
            ? { kind: "dependency", path: "mockups/asset.svg" }
            : { kind: "material" };
        assert.deepEqual(comparison.reasons, [reason]);
        assert.deepEqual(
          comparison.view.reasons,
          evidenceKind === "git" ? [reason] : undefined,
        );
      });
  });
