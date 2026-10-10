import assert from "node:assert/strict";
import test from "node:test";

import { compareComponentView } from "../dist/review/component_view.js";
import { PageAnalysisPair } from "../dist/review/page_pair.js";
import { pairedIgnoreTouchesStyles } from "../dist/review/style_source_safety.js";
import {
  changedStyleWindows,
  styleWindowSpans,
} from "../dist/review/style_windows.js";

import { pageContext } from "./helpers/page_comparison.js";
import {
  assertStyleRoute,
  selectedStyleViews,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

const start = "<!--mokly-review-ignore:start:clock-->";
const end = "<!--mokly-review-ignore:end:clock-->";
const material = (key: string) =>
  `<!--mokly-review-material:clock:${key.repeat(64)}-->`;

for (const mode of ["committed", "derived"] as const)
  test(`condition 3 proves whole style and window spans in ${mode}`, async (context) => {
    const fixture = await styleRouteFixture(context);
    for (const [name, markup, error] of [
      [
        "tag-bounded window",
        (value: string) =>
          `<style data-ignore="${start}">.entry{color:${value}}</style data-ignore="${end}">`,
        false,
      ],
      [
        "tag-bounded window with signal",
        (value: string) =>
          `<style data-ignore="${start}">.entry{color:${value}}</style data-ignore="${end}">${material("a")}`,
        true,
      ],
      [
        "content region outside window",
        (value: string) =>
          `<style>/*${start}same${end}*/.entry{color:${value}}</style>`,
        false,
      ],
      [
        "material marker in tag",
        (value: string) =>
          `<style data-material="${material("a")}">.entry{color:${value}}</style>${start}same${end}`,
        false,
      ],
    ] as const)
      await context.test(name, async () => {
        const input = withHeadStyles(
          fixture,
          markup("red"),
          markup("blue"),
          mode,
        );
        const { before, after } = selectedStyleViews(input);
        const pages = new PageAnalysisPair(
          before,
          after,
          Buffer.from(input.beforeFiles.get(before.path)!).toString(),
          Buffer.from(input.afterFiles.get(after.path)!).toString(),
        );
        for (const side of [pages.beforeAnalysis, pages.afterAnalysis])
          assert.equal(
            pairedIgnoreTouchesStyles(
              side.inlineStyles(pages.pairedIgnoreIds),
              side.ignored(pages.pairedIgnoreIds),
            ),
            name !== "material marker in tag",
          );
        // Inspect condition 3 before later reserved-content guards can hide a missing span proof.
        assert.equal(
          styleWindowSpans(
            pages,
            changedStyleWindows(pages.baseText, pages.headText)!,
          ),
          undefined,
        );
        if (error) {
          for (const useStylePath of [true, false])
            await assert.rejects(
              compareComponentView(
                { ...pageContext(input), useStylePath, useFastPath: false },
                before,
                after,
              ),
              {
                message: `[mokly/review-ignore] ${after.path}: material signal for clock has no region`,
              },
            );
        } else await assertStyleRoute(input, "complete", "home", false);
      });
    await context.test(
      "material-signal window before reserved-content guard",
      async () => {
        const markup = (key: string) =>
          `<style>/*${material(key)}*/.entry{color:red}</style>${start}same${end}`;
        const input = withHeadStyles(fixture, markup("a"), markup("b"), mode);
        const { before, after } = selectedStyleViews(input);
        const pages = new PageAnalysisPair(
          before,
          after,
          Buffer.from(input.beforeFiles.get(before.path)!).toString(),
          Buffer.from(input.afterFiles.get(after.path)!).toString(),
        );
        assert.equal(
          styleWindowSpans(
            pages,
            changedStyleWindows(pages.baseText, pages.headText)!,
          ),
          undefined,
        );
        await assertStyleRoute(input, "complete", "home", false);
      },
    );
  });
