import assert from "node:assert/strict";
import test from "node:test";

import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";
import {
  compareStyleSwitches,
  styleSwitches,
} from "./helpers/style_switches.js";

const ignored = (value: string) =>
  `<!--mokly-review-ignore:start:other-->${value}<!--mokly-review-ignore:end:other-->`;
const marker = String.raw`.entry:is([title="\3c !--mokly-review-material:clock:${"a".repeat(64)}-->"],main){background:url("../asset.svg")}`;

for (const mode of ["committed", "derived"] as const)
  test(`decoded selector markers preserve full validation in ${mode}`, async (context) => {
    const base = await styleRouteFixture(context);
    for (const identical of [true, false])
      await context.test(`identical=${identical}`, async (context) => {
        const markup = `<style>${marker}</style>`;
        const input = withHeadStyles(
          base,
          markup + (identical ? "" : ignored("before")),
          markup + (identical ? "" : ignored("after")),
          mode,
        );
        const fixture = {
          ...input,
          beforeFiles: new Map([...input.beforeFiles, ["asset.svg", "same"]]),
          afterFiles: new Map([...input.afterFiles, ["asset.svg", "same"]]),
        };
        for (const switches of styleSwitches)
          await context.test(JSON.stringify(switches), async () => {
            await assert.rejects(compareStyleSwitches(fixture, switches), {
              message:
                "[mokly/review-ignore] home/index.mobile.html: material signal for clock has no region",
            });
          });
      });
  });

for (const mode of ["committed", "derived"] as const)
  test(`ordinary CSS escapes and less-than strings keep quick checks in ${mode}`, async (context) => {
    const base = await styleRouteFixture(context);
    for (const css of [
      String.raw`.md\:flex{display:flex}`,
      String.raw`.w-1\/2{width:50%}`,
      String.raw`.hover\:bg-red:hover{background:red}`,
      String.raw`.entry{content:"\201C"}`,
      '.entry{content:"less < more"}',
    ])
      await context.test(css, async () => {
        const markup = `<style>${css}.entry{background:url("../asset.svg")}</style>`;
        for (const identical of [true, false]) {
          const input = withHeadStyles(
            base,
            markup + (identical ? "" : ignored("before")),
            markup + (identical ? "" : ignored("after")),
            mode,
          );
          const fixture = {
            ...input,
            beforeFiles: new Map([...input.beforeFiles, ["asset.svg", "same"]]),
            afterFiles: new Map([...input.afterFiles, ["asset.svg", "same"]]),
          };
          const { comparisonPath: _oracle, ...oracle } =
            await compareStyleSwitches(fixture, styleSwitches[0]);
          for (const useStylePath of [true, false]) {
            const { comparisonPath, ...actual } = await compareStyleSwitches(
              fixture,
              { useFastPath: true, useStylePath },
            );
            assert.equal(comparisonPath, "fast");
            assert.deepEqual(actual, oracle);
          }
        }
      });
  });
