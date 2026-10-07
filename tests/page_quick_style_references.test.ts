import assert from "node:assert/strict";
import test from "node:test";

import {
  assertStyleRoute,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

const outsideIgnore = (value: string) =>
  `<!--mokly-review-ignore:start:outside-->${value}<!--mokly-review-ignore:end:outside-->`;

for (const evidenceKind of ["git", "bytes"] as const)
  test(`identical quick check retains canonical style dependencies with ${evidenceKind} evidence`, async (context) => {
    const fixture = await styleRouteFixture(context);
    for (const [name, markup] of [
      [
        "CSS comment ignore",
        '<style>.entry{background:url("../../asset.svg")}/*<!--mokly-review-ignore:start:clock-->same<!--mokly-review-ignore:end:clock-->*/</style>',
      ],
      [
        "style tag attributes",
        '<style data-ignore="<!--mokly-review-ignore:start:clock-->">.entry{background:url("../../asset.svg")}</style data-ignore="<!--mokly-review-ignore:end:clock-->">',
      ],
      [
        "removed component marker",
        '<style>.entry{background:url("../../asset.svg")}/*<!--mokly-component:start:r-77-->*/</style>',
      ],
      [
        "removed component marker with a non-identical outside ignore",
        '<style>.entry{background:url("../../asset.svg")}/*<!--mokly-component:start:r-77-->*/</style>',
      ],
    ])
      await context.test(name!, async () => {
        const input = withHeadStyles(
          fixture,
          markup! +
            (name!.includes("non-identical") ? outsideIgnore("old") : ""),
          markup! +
            (name!.includes("non-identical") ? outsideIgnore("new") : ""),
        );
        const { comparison } = await assertStyleRoute(
          {
            ...input,
            beforeFiles: new Map([...input.beforeFiles, ["asset.svg", "old"]]),
            afterFiles: new Map([...input.afterFiles, ["asset.svg", "new"]]),
            changedPaths: evidenceKind === "git" ? ["mockups/asset.svg"] : [],
          },
          "complete",
        );
        assert.equal(comparison.view.state, "changed");
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
