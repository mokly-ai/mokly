import assert from "node:assert/strict";
import test from "node:test";

import { PageAnalysisPair } from "../dist/review/page_pair.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { comparePageViews } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const style = (color: string) =>
  `<style>.entry{color:${color};background:url("../ignored.svg")}</style>`;
const region = (content: string) =>
  `<textarea><!--mokly-review-ignore:start:raw--></textarea>${content}<textarea><!--mokly-review-ignore:end:raw--></textarea>`;

for (const mode of ["committed", "derived"] as const)
  for (const paired of [true, false])
    test(`flat textarea ignores ${paired ? "suppress" : "do not suppress"} style analysis in ${mode}`, async (context) => {
      const fixture = await inlineChangesFixture(
        context,
        paired ? region(style("red")) : style("red"),
        region(style("blue")),
        {
          colorSchemes: false,
          files: {
            before: { "ignored.svg": "old" },
            after: { "ignored.svg": "new" },
          },
        },
      );
      const input = await pageFixtureInput(fixture, mode);
      const before = generatedViews(
        input.before.entries.find(({ id }) => id === "home")!,
      )[0]!;
      const after = generatedViews(
        input.after.entries.find(({ id }) => id === "home")!,
      )[0]!;
      const text = (
        files: ReadonlyMap<string, string | Uint8Array>,
        route: string,
      ) => Buffer.from(files.get(route)!).toString();
      const pages = new PageAnalysisPair(
        before,
        after,
        text(input.beforeFiles, before.path),
        text(input.afterFiles, after.path),
      );
      assert.equal(
        pages.afterAnalysis.inlineStyles(pages.pairedIgnoreIds).length,
        paired ? 0 : 1,
      );
      const current = (await comparePageViews(input)).filter(
        ({ entryId }) => entryId === "home",
      );
      assert.equal(current.length, 2);
      for (const { comparison, path } of current) {
        assert.equal(
          comparison.view.state,
          paired ? "ignored-only" : "changed",
          path,
        );
        assert.deepEqual(
          comparison.view.ignoredIds,
          paired ? ["raw"] : [],
          path,
        );
        if (paired) {
          assert.equal(comparison.view.material, undefined, path);
          assert.equal(comparison.view.inlineStyles, undefined, path);
          assert.deepEqual(comparison.reasons, [], path);
          assert.equal(comparison.comparisonPath, "fast", path);
        } else
          assert.equal(comparison.view.inlineStyles?.status, "matched", path);
      }
      if (paired) {
        const old = (await comparePageViews(input, true)).filter(
          ({ entryId }) => entryId === "home",
        );
        assert.ok(
          old.every(({ comparison }) => comparison.view.state === "changed"),
          "M6's DOM-comment eligibility missed flat raw-text regions",
        );
      }
    });
