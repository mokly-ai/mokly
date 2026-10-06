import assert from "node:assert/strict";
import test from "node:test";

import { prepareComponentProjection } from "../dist/review/component_projection_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { inlineMaterialReplacements } from "../dist/review/css/inline_rendering.js";
import { inlineLinkMaterialChanges } from "../dist/review/inline_link_material.js";
import { PageAnalysisPair } from "../dist/review/page_pair.js";

import {
  assertFingerprintComparison,
  comparisonMaterials,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { moveLinkShortcutFixture } from "./helpers/move_link_shortcuts.js";
import {
  selectedStyleViews,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";
import { styleSwitches } from "./helpers/style_switches.js";

test("equal-source skipped link proof adds no normalization call", async (t) => {
  const style =
    '<style data-nav-href="../home/index.html">.entry{color:red}</style>';
  const fixture = withHeadStyles(
    await styleRouteFixture(t),
    style,
    style,
    "committed",
  );
  const { before, after } = selectedStyleViews(fixture);
  const analysis = fingerprintMaterials(fixture, false).inlineAnalysis!;
  assert.equal(analysis.status, "skipped");
  const pages = new PageAnalysisPair(before, after, "", "", {
    equalSource: true,
    before: () => assert.fail("identical normalizers need no source rewrite"),
    after: () => assert.fail("identical normalizers need no source rewrite"),
  });
  assert.equal(
    inlineLinkMaterialChanges(pages, analysis, {
      before: inlineMaterialReplacements(analysis, "before"),
      after: inlineMaterialReplacements(analysis, "after"),
    }),
    false,
  );
});

for (const mode of ["committed", "derived"] as const) {
  test(`an unchanged URL beside an edited rule retains fingerprints in ${mode}`, async (t) => {
    const original = withHeadStyles(
      await styleRouteFixture(t),
      '<style>.entry{background:url("../asset.svg")}.entry{color:red}</style>',
      '<style>.entry{background:url("../asset.svg")}.entry{color:blue}</style>',
      mode,
    );
    const fixture = {
      ...original,
      beforeFiles: new Map([...original.beforeFiles, ["asset.svg", "image"]]),
      afterFiles: new Map([...original.afterFiles, ["asset.svg", "image"]]),
    };
    await assertFingerprintComparison(fixture);
    const fingerprint = fingerprintMaterials(fixture);
    const text = fingerprintMaterials(fixture, false);
    assert.deepEqual(fingerprint.references, text.references);
    for (const material of comparisonMaterials(fingerprint))
      assert.match(material, /<!--mokly-inline-rules:/);
  });

  test(`skipped styles keep text when link identities differ in ${mode}`, async (t) => {
    const fixture = await moveLinkShortcutFixture(t, mode, false, true, true);
    const before = fixture.beforeViews[0]!;
    const after = fixture.afterViews[0]!;
    const context = await fixture.context();
    assert.equal(context.links!(before.path, after.path).equalSource, false);
    const prepare = (enabled: boolean) =>
      prepareComponentProjection(
        { ...context, useMaterialFingerprints: enabled },
        before,
        after,
        fixture.before.outputs.get(before.path) as string,
        fixture.after.outputs.get(after.path) as string,
      );
    const text = prepare(false);
    const fingerprint = prepare(true);
    assert.deepEqual(fingerprint.references, text.references);
    assert.deepEqual(
      comparisonMaterials(fingerprint),
      comparisonMaterials(text),
    );
    for (const switches of styleSwitches) {
      const compare = async (enabled: boolean) =>
        compareComponentView(
          {
            ...(await fixture.context()),
            ...switches,
            useMaterialFingerprints: enabled,
          },
          before,
          after,
        );
      assert.deepEqual(await compare(true), await compare(false));
    }
  });
}
