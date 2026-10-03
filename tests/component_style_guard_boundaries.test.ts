import assert from "node:assert/strict";
import test from "node:test";

import { PageAnalysisPair } from "../dist/review/page_pair.js";
import {
  changedStyleWindows,
  styleWindowSpans,
} from "../dist/review/style_windows.js";

import {
  assertStyleRoute,
  selectedStyleViews,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

for (const mode of ["committed", "derived"] as const)
  test(`base raw-text and tag boundaries force full comparison in ${mode}`, async (context) => {
    const fixture = await styleRouteFixture(context);
    for (const [name, base, head] of [
      [
        "base-only raw end tag",
        "<style>.entry{color:red}/*</style>*/</style>",
        "<style>.entry{color:red}/*x*/</style>",
      ],
      [
        "base-only less-than",
        '<style>.entry{content:"<"}</style>',
        '<style>.entry{content:"x"}</style>',
      ],
      [
        "type attribute beyond the raw-text guard",
        '<style type="text/plain">.entry{color:red}</style>',
        '<style type="text/css">.entry{color:red}</style>',
      ],
      [
        "long data attribute",
        '<style data-sheet="long-value-red">.entry{color:red}</style>',
        '<style data-sheet="long-value-blue">.entry{color:red}</style>',
      ],
      [
        "end-tag attribute",
        '<style>.entry{color:red}</style data-sheet="long-value-red">',
        '<style>.entry{color:red}</style data-sheet="long-value-blue">',
      ],
    ])
      await context.test(name!, async () => {
        const input = withHeadStyles(fixture, base!, head!, mode);
        const { before, after } = selectedStyleViews(input);
        const pages = new PageAnalysisPair(
          before,
          after,
          Buffer.from(input.beforeFiles.get(before.path)!).toString(),
          Buffer.from(input.afterFiles.get(after.path)!).toString(),
        );
        const windows = changedStyleWindows(pages.baseText, pages.headText)!;
        if (!name!.startsWith("base-only")) {
          assert.ok(
            !pages.headText
              .slice(windows.after.start - 8, windows.after.end)
              .includes("<"),
          );
          assert.equal(styleWindowSpans(pages, windows), undefined);
        }
        await assertStyleRoute(input, "complete");
      });
  });

for (const mode of ["committed", "derived"] as const)
  test(`selector compilation failures remain routed and unresolved in ${mode}`, async (context) => {
    const fixture = await styleRouteFixture(context);
    for (const selector of ["&", ".entry:is()", ".entry:where()"])
      await context.test(selector, async () => {
        const { comparison } = await assertStyleRoute(
          withHeadStyles(
            fixture,
            `<style>${selector}{color:red}</style>`,
            `<style>${selector}{color:blue}</style>`,
            mode,
          ),
          "style",
        );
        assert.equal(comparison.view.inlineStyles?.status, "unresolved");
      });
  });
