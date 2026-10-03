import assert from "node:assert/strict";
import test from "node:test";

import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";
import {
  compareStyleSwitches,
  styleSwitches,
} from "./helpers/style_switches.js";

for (const mode of ["committed", "derived"] as const)
  test(`decoded reserved prefixes use ASCII case folding in ${mode}`, async (context) => {
    const base = await styleRouteFixture(context);
    for (const [word, expected] of [
      ["MoKlY", "complete"],
      ["moKly", "fast"],
    ] as const)
      await context.test(word, async () => {
        const markup = String.raw`<style>.entry:is([title="\3C !--${word}-component:start:r-1-->"],main){background:url("../asset.svg")}</style>`;
        const input = withHeadStyles(base, markup, markup, mode);
        const fixture = {
          ...input,
          beforeFiles: new Map([...input.beforeFiles, ["asset.svg", "same"]]),
          afterFiles: new Map([...input.afterFiles, ["asset.svg", "same"]]),
        };
        const { comparisonPath: _path, ...oracle } = await compareStyleSwitches(
          fixture,
          styleSwitches[0],
        );
        for (const useStylePath of [false, true]) {
          const { comparisonPath, ...actual } = await compareStyleSwitches(
            fixture,
            { useFastPath: true, useStylePath },
          );
          assert.equal(comparisonPath, expected);
          assert.deepEqual(actual, oracle);
        }
      });
  });
