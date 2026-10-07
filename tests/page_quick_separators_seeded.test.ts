import assert from "node:assert/strict";
import test from "node:test";

import { separatorMarkerCases } from "./helpers/css_marker_separators.js";
import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";
import {
  captureStyleSwitches,
  styleSwitches,
} from "./helpers/style_switches.js";

test("seeded separators, URL contexts and continuations preserve both optimized paths", async (context) => {
  const seed = 0x5eeda33;
  const generated = separatorMarkerCases(seed);
  const base = await styleRouteFixture(context);
  let fast = 0;
  let style = 0;
  let compared = 0;
  for (const { index, kind, css, control } of generated.cases)
    for (const change of ["identical", "ignored", "style"] as const)
      try {
        const ignore = (text: string) =>
          change === "ignored"
            ? `<!--mokly-review-ignore:start:other-->${text}<!--mokly-review-ignore:end:other-->`
            : "";
        const color = (value: string) =>
          change === "style" ? `.entry{color:${value}}` : "";
        const input = withHeadStyles(
          base,
          `<style>${css}${color("red")}</style>${ignore("before")}`,
          `<style>${css}${color("blue")}</style>${ignore("after")}`,
        );
        const fixture = {
          ...input,
          beforeFiles: new Map([...input.beforeFiles, ["asset.svg", "same"]]),
          afterFiles: new Map([...input.afterFiles, ["asset.svg", "same"]]),
        };
        const oracle = await captureStyleSwitches(fixture, styleSwitches[0]);
        for (const switches of styleSwitches.slice(1)) {
          const actual = await captureStyleSwitches(fixture, switches);
          compared++;
          if (actual.kind === "result") {
            assert.equal(oracle.kind, "result");
            if (oracle.kind === "result")
              assert.deepEqual(actual.result, oracle.result);
            if (actual.comparisonPath === "fast") fast++;
            if (actual.comparisonPath === "style") style++;
            if (control)
              assert.equal(
                actual.comparisonPath,
                change === "style"
                  ? switches.useStylePath
                    ? "style"
                    : "complete"
                  : switches.useFastPath
                    ? "fast"
                    : "complete",
              );
          } else assert.deepEqual(actual, oracle);
        }
      } catch (cause) {
        throw new Error(
          `seed=${seed} case=${index} context=${kind} change=${change}`,
          { cause },
        );
      }
  assert.equal(compared, 1296);
  assert.ok(fast >= 96, `seed=${seed} fast=${fast}`);
  assert.ok(style >= 48, `seed=${seed} style=${style}`);
  assert.deepEqual(generated.seen, new Set(generated.separators));
  for (const name of generated.urlNames)
    assert.ok(generated.contexts.has(name), name);
  context.diagnostic(
    `seed=${seed}: ${compared} comparisons, fast=${fast}, style=${style}`,
  );
});
