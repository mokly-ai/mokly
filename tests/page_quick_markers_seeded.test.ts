import assert from "node:assert/strict";
import test from "node:test";

import { markerEncoder } from "./helpers/css_marker_edits.js";
import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";
import {
  captureStyleSwitches,
  styleSwitches,
} from "./helpers/style_switches.js";

test("seeded decoded markers and ordinary escapes equal the complete-path oracle", async (context) => {
  const seed = 0x5eeda11;
  const encoder = markerEncoder(seed);
  const base = await styleRouteFixture(context);
  const markers = [
    `<!--mokly-review-material:clock:${"a".repeat(64)}-->`,
    "<!--mokly-component:start:r-1-->",
    "<!--ordinary-component:start:r-1-->",
  ];
  let quick = 0;
  let compared = 0;
  for (let index = 0; index < 144; index++) {
    const kind = index % 3;
    const marker = Math.floor(index / 3) % 3;
    const encoded = encoder.encode(markers[marker]!, index, kind !== 2);
    const reference = 'background:url("../../asset.svg")';
    const css =
      kind === 0
        ? `.entry:is([title="${encoded}"],main){${reference}}`
        : kind === 1
          ? `.entry{content:"${encoded}";${reference}}`
          : `.entry{--${encoded}:1;${reference}}`;
    const ignored = (value: string) =>
      index % 2
        ? `<!--mokly-review-ignore:start:other-->${value}<!--mokly-review-ignore:end:other-->`
        : "";
    try {
      const input = withHeadStyles(
        base,
        `<style>${css}</style>${ignored("before")}`,
        `<style>${css}</style>${ignored("after")}`,
      );
      const fixture = {
        ...input,
        beforeFiles: new Map([...input.beforeFiles, ["asset.svg", "same"]]),
        afterFiles: new Map([...input.afterFiles, ["asset.svg", "same"]]),
      };
      const oracle = await captureStyleSwitches(fixture, styleSwitches[0]);
      for (const useStylePath of [false, true]) {
        const result = await captureStyleSwitches(fixture, {
          useFastPath: true,
          useStylePath,
        });
        compared++;
        if (result.kind === "result") {
          assert.equal(oracle.kind, "result");
          if (oracle.kind === "result")
            assert.deepEqual(result.result, oracle.result);
          assert.equal(
            result.comparisonPath,
            marker === 2 ? "fast" : "complete",
          );
          if (result.comparisonPath === "fast") quick++;
        } else assert.deepEqual(result, oracle);
      }
    } catch (cause) {
      throw new Error(
        `seed=${seed} case=${index} context=${kind} marker=${marker}`,
        { cause },
      );
    }
  }
  assert.equal(compared, 288);
  assert.equal(
    quick,
    96,
    `seed=${seed}: ordinary escaped inputs must keep the quick check`,
  );
  assert.deepEqual([...encoder.lengths].sort(), [2, 3, 4, 5, 6]);
  assert.deepEqual(
    new Set(encoder.terminators),
    new Set(["", " ", "\t", "\n", "\r", "\r\n", "\f"]),
  );
  assert.deepEqual(
    new Set(encoder.continuations),
    new Set(["\n", "\r", "\r\n", "\f"]),
  );
  context.diagnostic(
    `seed=${seed}: ${compared} oracle comparisons, ${quick} quick settlements`,
  );
});
