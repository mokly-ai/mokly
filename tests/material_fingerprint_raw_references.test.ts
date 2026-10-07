import assert from "node:assert/strict";
import test from "node:test";

import {
  fingerprintComparison,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { fingerprintRenderer } from "./helpers/fingerprint_fixture.js";
import { assertGuardedMaterials } from "./helpers/fingerprint_guard_assertions.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

for (const mode of ["committed", "derived"] as const)
  for (const css of [
    "@namespace url(../image.svg);.entry{color:red}",
    '.entry:is(url("../image.svg")){color:red}',
  ])
    test(`skipped raw references preserve dependency evidence: ${mode}: ${css}`, async (context) => {
      const style = `<style>${css}</style>`;
      const fixture = await inlineChangesFixture(context, style, style, {
        colorSchemes: false,
        files: {
          before: { "image.svg": '<svg width="10"/>' },
          after: { "image.svg": '<svg width="20"/>' },
        },
      });
      const input = await pageFixtureInput(fixture, mode);
      const text = fingerprintMaterials(input, false);
      assert.equal(text.inlineAnalysis?.status, "skipped");
      assert.ok(text.references!.actualBefore.includes("../../image.svg"));
      const outcome = await fingerprintComparison(input, false);
      assert.equal(outcome.kind, "result");
      if (outcome.kind === "result") {
        assert.equal(outcome.result.view.state, "changed");
        assert.ok(
          outcome.result.reasons.some(
            (reason) =>
              reason.kind === "dependency" &&
              reason.path === "mockups/image.svg",
          ),
        );
      }
      await assertGuardedMaterials(input, css);
    });

for (const css of [
  String.raw`.md\:flex{display:flex}`,
  String.raw`.w-1\/2{width:50%}`,
  String.raw`.hover\:bg-red:hover{color:red}`,
])
  test(`escaped reference-free utility styles retain fingerprints: ${css}`, async (context) => {
    const style = `<style>${css}</style>`;
    const renderer = fingerprintRenderer(style);
    const fixture = await inlineChangesFixture(context, style, style, {
      colorSchemes: false,
      renderer: { before: renderer, after: renderer },
    });
    for (const mode of ["committed", "derived"] as const) {
      const input = await pageFixtureInput(fixture, mode);
      const prepared = fingerprintMaterials(input);
      assert.equal(prepared.inlineAnalysis?.status, "skipped");
      assert.equal(prepared.inlineAnalysis.beforeSpans[0]?.text, css);
      assert.ok(
        prepared.projected.actual.base.includes("<!--mokly-inline-style:"),
      );
    }
  });

test("style id anchors preserve fingerprints because they do not seed resources", async (context) => {
  const style =
    '<style id="react-native-stylesheet" data-nav-href="#react-native-stylesheet">.entry{padding:1px}</style>';
  const fixture = await inlineChangesFixture(context, style, style, {
    colorSchemes: false,
  });
  for (const mode of ["committed", "derived"] as const) {
    const input = await pageFixtureInput(fixture, mode);
    const text = fingerprintMaterials(input, false);
    const current = fingerprintMaterials(input);
    assert.equal(text.inlineAnalysis?.status, "skipped");
    assert.deepEqual(current.references, text.references);
    assert.ok(
      current.projected.actual.base.includes("<!--mokly-inline-style:"),
    );
  }
});
