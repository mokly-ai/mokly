import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { compareComponentView } from "../dist/review/component_view.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";
import { PageAnalysisPair } from "../dist/review/page_pair.js";

import { fingerprintComparison } from "./helpers/fingerprint_comparison.js";
import { fingerprintRenderer } from "./helpers/fingerprint_fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageContext } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";
import { selectedStyleViews } from "./helpers/style_route.js";

const inventories = [
  "materialIds",
  "materialSignals",
  "componentMarkers",
] as const;
const region = (text: string) =>
  `<!--mokly-review-ignore:start:clock-->${text}<!--mokly-review-ignore:end:clock-->`;
const signal = `<!--mokly-review-material:clock:${"a".repeat(64)}-->`;

function forbidInventories(context: TestContext) {
  const inlineStyles = PageAnalysis.prototype.inlineStyles;
  let inspected = 0;
  context.mock.method(
    PageAnalysis.prototype,
    "inlineStyles",
    function (this: PageAnalysis, paired: readonly string[]) {
      inspected++;
      for (const name of inventories)
        assert.equal(
          Object.getOwnPropertyDescriptor(this, name)?.value,
          undefined,
          `shortcut allocated ${name}`,
        );
      return inlineStyles.call(this, paired);
    },
  );
  for (const name of inventories)
    if (Object.getOwnPropertyDescriptor(PageAnalysis.prototype, name)?.get)
      context.mock.getter(PageAnalysis.prototype, name, () =>
        assert.fail(`shortcut requested ${name}`),
      );
  return () => assert.ok(inspected > 0, "must inspect the compared view");
}

for (const mode of ["committed", "derived"] as const)
  for (const kind of ["identical", "ignored", "style"] as const)
    for (const signals of [false, true])
      test(`${mode} ${kind} shortcut requests no fingerprint inventory, signals=${signals}`, async (context) => {
        const styles = (color: string, text: string) =>
          `<style>.entry{color:${color}}</style>${region(text)}${signals ? signal : ""}`;
        const before = styles("red", "same");
        const after = styles(
          kind === "style" ? "blue" : "red",
          kind === "ignored" ? "later" : "same",
        );
        const fixture = await inlineChangesFixture(context, "", "", {
          colorSchemes: false,
          renderer: {
            before: fingerprintRenderer(before),
            after: fingerprintRenderer(after),
          },
        });
        const input = await pageFixtureInput(fixture, mode);
        const oracle = await fingerprintComparison(input, false);
        assert.equal(oracle.kind, "result");
        if (oracle.kind !== "result") return;
        const { comparisonPath: _oraclePath, ...expected } = oracle.result;
        const observed = forbidInventories(context);
        context.mock.getter(
          PageAnalysisPair.prototype,
          "fingerprintProofs",
          () => assert.fail("shortcut requested fingerprint proofs"),
        );
        context.mock.method(
          PageAnalysisPair.prototype,
          "rememberStyleSafety",
          () => assert.fail("settled shortcut retained a fall-through proof"),
        );
        const includes = String.prototype.includes;
        let scans = 0;
        context.mock.method(
          String.prototype,
          "includes",
          function (this: string, needle: string, start?: number) {
            if (
              needle === "<!--mokly-review-" &&
              /^<style>\.entry\{color:(red|blue)\}<\/style>$/.test(String(this))
            )
              scans++;
            return includes.call(this, needle, start);
          },
        );
        const views = selectedStyleViews(input);
        const result = await compareComponentView(
          pageContext(input),
          views.before,
          views.after,
          views.root,
        );
        assert.equal(
          result.comparisonPath,
          kind === "style" ? "style" : "fast",
        );
        const { comparisonPath: _path, ...actual } = result;
        assert.deepEqual(actual, expected);
        assert.equal(
          scans,
          kind === "style" ? 0 : kind === "identical" ? 1 : 2,
          "shortcut source-safety scan count stays unchanged",
        );
        observed();
      });
