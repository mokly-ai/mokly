import assert from "node:assert/strict";
import test from "node:test";

import { compareComponentView } from "../dist/review/component_view.js";

import { pageContext } from "./helpers/page_comparison.js";
import {
  selectedStyleViews,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

const start = "<!--mokly-review-ignore:start:clock-->";
const end = "<!--mokly-review-ignore:end:clock-->";
const material = `<!--mokly-review-material:clock:${"a".repeat(64)}-->`;
const style = (css: string) => `<style>${css}</style>`;
const switches = [
  { useFastPath: true, useStylePath: true },
  { useFastPath: true, useStylePath: false },
  { useFastPath: false, useStylePath: false },
  { useFastPath: false, useStylePath: true },
];

for (const mode of ["committed", "derived"] as const) {
  test(`raw ignored style content uses complete material semantics in ${mode}`, async (context) => {
    const base = await styleRouteFixture(context);
    for (const [name, markup, state] of [
      [
        "edited CSS comment",
        (value: string) => style(`.entry{color:/*${start}${value}${end}*/red}`),
        "unchanged",
      ],
      [
        "unchanged eligible style beside ignored content change",
        (value: string) =>
          style(`/*${start}same${end}*/.entry{color:red}`) +
          `<!--mokly-review-ignore:start:other-->${value}<!--mokly-review-ignore:end:other-->`,
        "ignored-only",
      ],
      [
        "region spans two styles",
        (value: string) =>
          `<style>.entry{color:red}/*${start}same*/</style><style>/*${value}${end}*/.entry{color:red}</style>`,
        "ignored-only",
      ],
      [
        "markers in tag attributes",
        (value: string) =>
          `<style data-ignore="${start}">.entry{color:/*${value}*/red}</style data-ignore="${end}">`,
        "unchanged",
      ],
      [
        "ordinary region outside styles",
        (value: string) => style(".entry{color:red}") + start + value + end,
        "ignored-only",
      ],
    ] as const)
      await context.test(name, async () => {
        const fixture = withHeadStyles(
          base,
          markup("red"),
          markup("blue"),
          mode,
        );
        const { before, after } = selectedStyleViews(fixture);
        let oracle;
        for (const setting of [...switches].reverse()) {
          const result = await compareComponentView(
            { ...pageContext(fixture), ...setting },
            before,
            after,
          );
          const { comparisonPath, ...value } = result;
          assert.equal(
            comparisonPath,
            name === "ordinary region outside styles" && setting.useFastPath
              ? "fast"
              : "complete",
          );
          oracle ??= value;
          assert.deepEqual(value, oracle, after.path);
          assert.equal(value.view.state, state);
          assert.equal(value.view.material, undefined);
          assert.deepEqual(value.reasons, []);
          assert.deepEqual(
            value.view.ignoredIds,
            state === "unchanged"
              ? []
              : [name.startsWith("unchanged eligible") ? "other" : "clock"],
          );
          assert.equal(value.view.inlineStyles, undefined);
        }
      });
  });

  test(`style removal preserves missing-region validation in ${mode}`, async (context) => {
    const base = await styleRouteFixture(context);
    for (const [name, markup] of [
      [
        "paired markers in unchanged tags",
        (color: string) =>
          `<style data-ignore="${start}">.same{color:black}</style data-ignore="${end}">${material}${style(`.entry{color:${color}}`)}`,
      ],
      [
        "paired markers in edited content",
        (color: string) =>
          style(`/*${start}same${end}*/.entry{color:${color}}`) + material,
      ],
    ] as const)
      await context.test(name, async () => {
        const fixture = withHeadStyles(
          base,
          markup("red"),
          markup("blue"),
          mode,
        );
        const { before, after } = selectedStyleViews(fixture);
        for (const setting of switches)
          await assert.rejects(
            compareComponentView(
              { ...pageContext(fixture), ...setting },
              before,
              after,
            ),
            {
              message: `[mokly/review-ignore] ${after.path}: material signal for clock has no region`,
            },
          );
      });
  });
}
