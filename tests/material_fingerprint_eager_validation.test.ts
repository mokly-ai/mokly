import assert from "node:assert/strict";
import test from "node:test";

import { PageAnalysis } from "../dist/review/page_analysis.js";

import { fingerprintComparison } from "./helpers/fingerprint_comparison.js";
import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";

const start = "<!--mokly-review-ignore:start:clock-->";
const end = "<!--mokly-review-ignore:end:clock-->";
const signal = `<!--mokly-review-material:clock:${"a".repeat(64)}-->`;
const cases = [
  [signal, "material signal for clock has no region"],
  [start, "region clock has no end marker"],
  [end, "end marker for clock has no start"],
  [
    start + "same" + end + signal + signal,
    "duplicate material signal for clock",
  ],
  [
    "<!--mokly-review-material:clock:bad-->",
    "invalid material signal <!--mokly-review-material:clock:bad-->",
  ],
] as const;

test("lazy fingerprint inventories preserve eager per-view validation errors", async (context) => {
  const fixture = await styleRouteFixture(context);
  for (const mode of ["committed", "derived"] as const)
    for (const [marker, detail] of cases)
      await context.test(`${mode}: ${detail}`, async (test) => {
        const html = `<style>.entry{color:red}</style>${marker}`;
        const input = withHeadStyles(fixture, html, html, mode);
        const oracle = await fingerprintComparison(input, false);
        assert.equal(oracle.kind, "error");
        if (oracle.kind !== "error") return;
        assert.ok(oracle.message.endsWith(detail));
        for (const name of [
          "materialIds",
          "materialSignals",
          "componentMarkers",
        ] as const)
          test.mock.getter(PageAnalysis.prototype, name, () =>
            assert.fail(`validation requested fingerprint inventory ${name}`),
          );
        for (const useFastPath of [true, false])
          for (const useStylePath of [true, false])
            assert.deepEqual(
              await fingerprintComparison(input, true, "home", undefined, {
                useFastPath,
                useStylePath,
              }),
              oracle,
            );
      });
});
