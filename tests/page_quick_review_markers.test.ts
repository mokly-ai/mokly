import assert from "node:assert/strict";
import test from "node:test";

import {
  selectedStyleViews,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";
import {
  compareStyleSwitches,
  styleSwitches,
} from "./helpers/style_switches.js";

const start = "<!--mokly-review-ignore:start:clock-->";
const end = "<!--mokly-review-ignore:end:clock-->";
const signal = `<!--mokly-review-material:clock:${"a".repeat(64)}-->`;
const reference = '<style>.entry{background:url("../../asset.svg")}</style>';
const oneSided = `<style>.entry{color:red}/*${start}*/</style><p>x</p>${end}`;
const plain = "<style>.entry{color:red}/**/</style><p>x</p>";

for (const mode of ["committed", "derived"] as const)
  test(`quick checks preserve review-marker validation in ${mode}`, async (context) => {
    const base = await styleRouteFixture(context);
    const identical = [
      [
        "identical content markers",
        `${reference}<style>/*${start}same${end}*/.x{color:red}</style>${signal}`,
        "material signal for clock has no region",
      ],
      [
        "identical tag markers",
        `${reference}<style data-i="${start}">.x{color:red}</style data-i="${end}">${signal}`,
        "material signal for clock has no region",
      ],
      [
        "identical split markers",
        `${reference}<style>/*${start}*/.x{color:red}</style><p>x</p>${end}`,
        "end marker for clock has no start",
      ],
    ];
    for (const [name, left, right, error] of [
      ...identical.map(
        ([name, text, error]) => [name!, text!, text!, error!] as const,
      ),
      [
        "unchanged style markers beside non-identical ignored text",
        `${reference}<style>/*${start}same${end}*/.x{color:red}</style>${signal}<!--mokly-review-ignore:start:other-->before<!--mokly-review-ignore:end:other-->`,
        `${reference}<style>/*${start}same${end}*/.x{color:red}</style>${signal}<!--mokly-review-ignore:start:other-->after<!--mokly-review-ignore:end:other-->`,
        "material signal for clock has no region",
      ],
      [
        "base-only region",
        oneSided,
        plain,
        "end marker for clock has no start",
      ],
      [
        "head-only region",
        plain,
        oneSided,
        "end marker for clock has no start",
      ],
    ] as const)
      await context.test(name, async (context) => {
        const input = withHeadStyles(base, left, right, mode);
        const fixture = {
          ...input,
          beforeFiles: new Map([...input.beforeFiles, ["asset.svg", "same"]]),
          afterFiles: new Map([...input.afterFiles, ["asset.svg", "same"]]),
        };
        const { after } = selectedStyleViews(fixture);
        for (const switches of styleSwitches)
          await context.test(JSON.stringify(switches), async () => {
            await assert.rejects(compareStyleSwitches(fixture, switches), {
              message: `[mokly/review-ignore] ${after.path}: ${error}`,
            });
          });
      });
  });

for (const mode of ["committed", "derived"] as const)
  test(`one-sided style material signals retain complete states in ${mode}`, async (context) => {
    const base = await styleRouteFixture(context);
    for (const attribute of [false, true])
      for (const mirrored of [false, true])
        await context.test(
          `attribute=${attribute}, mirrored=${mirrored}`,
          async (context) => {
            const markup = (signal: string) =>
              attribute
                ? `<style data-m="${signal}">.entry{color:red}</style>${start}x${end}`
                : `<style>/*${signal}*/.entry{color:red}</style>${start}x${end}`;
            const fixture = withHeadStyles(
              base,
              markup(mirrored ? "" : signal),
              markup(mirrored ? signal : ""),
              mode,
            );
            const oracle = await compareStyleSwitches(
              fixture,
              styleSwitches[0],
            );
            for (const switches of styleSwitches)
              await context.test(JSON.stringify(switches), async () => {
                const result = await compareStyleSwitches(fixture, switches);
                assert.deepEqual(result, oracle);
                assert.equal(result.comparisonPath, "complete");
                assert.equal(result.view.state, "unchanged");
                assert.deepEqual(result.view.ignoredIds, []);
                assert.equal(result.view.material, undefined);
                assert.deepEqual(result.reasons, []);
              });
          },
        );
  });
