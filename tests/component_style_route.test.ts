import assert from "node:assert/strict";
import test from "node:test";

import {
  assertStyleRoute,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

for (const mode of ["committed", "derived"] as const)
  test(`style route preserves attribution and material in ${mode}`, async (context) => {
    const fixture = await styleRouteFixture(context);
    for (const [selector, state, evidence, owners] of [
      [".missing", "unchanged", "excluded", []],
      [".actual-only", "changed", undefined, ["action"]],
      [".entry", "changed", "matched", []],
      [":root", "changed", "unresolved", []],
      [".entry:unknown-pseudo", "changed", "unresolved", []],
      ['[data-label=":empty"]', "unchanged", "excluded", []],
    ] as const)
      await context.test(selector, async () => {
        const input = withHeadStyles(
          fixture,
          `<style>${selector}{color:red}</style>`,
          `<style>${selector}{color:blue}</style>`,
          mode,
        );
        const { comparison } = await assertStyleRoute(input, "style");
        assert.equal(comparison.view.state, state);
        assert.equal(comparison.view.inlineStyles?.status, evidence);
        assert.deepEqual([...comparison.changedImplementations], owners);
      });
  });
