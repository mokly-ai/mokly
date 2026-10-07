import assert from "node:assert/strict";
import test from "node:test";

import type { ReviewResultV6 } from "../packages/viewer/dist/data.js";

import {
  changedEntryPaths,
  impactingIds,
  manifestScreenConsumers,
  reasonsOf,
  screenConsumersOf,
  usageChainsOf,
  usageVariantsOf,
} from "./helpers/attribution_result.js";
import { resourceReasonSummaries } from "./helpers/css_evidence.js";
import { designLibrary } from "./helpers/design_library.js";
import { selectors } from "./helpers/design_library_css.js";
import { designLibraryFixture } from "./helpers/design_library_fixture.js";
import { libraryStylesheetPath } from "./helpers/design_stylesheets.js";
import { fileFixture } from "./helpers/file_fixture.js";

const sharedFixture = fileFixture((owner) => designLibraryFixture(owner));
const unmatchedVariants = new Set([
  "design/library/controls/tag-picker/empty",
  "design/library/inspector/metadata-row/code",
]);

test("library stylesheets attribute only to their own component in one pass", async (t) => {
  const fixture = await sharedFixture();
  await fixture.reset();
  for (const [group, slug] of designLibrary)
    await fixture.edit(
      libraryStylesheetPath(group, slug),
      (source) => source + `\n${selectors[slug]} { outline-width: 3px; }\n`,
    );
  const result = await fixture.compare();
  const ids = designLibrary
    .map(([group, slug]) => `design/library/${group}/${slug}`)
    .sort();
  const savedVariants = designLibrary.flatMap(([group, slug, variants]) => {
    const id = `design/library/${group}/${slug}`;
    return variants.map((variant) => `${id}/${variant}`);
  });
  const matchedVariants = savedVariants.filter(
    (path) => !unmatchedVariants.has(path),
  );
  assert.equal(ids.length, 16);
  assert.equal(savedVariants.length, 69);
  assert.equal(matchedVariants.length, 67);
  assert.deepEqual(
    changedEntryPaths(result),
    [...ids, ...matchedVariants].sort(),
  );
  assert.deepEqual(impactingIds(result), ids);
  for (const [group, slug, variants] of designLibrary) {
    const id = `design/library/${group}/${slug}`;
    const stylesheet = libraryStylesheetPath(group, slug);
    const expectedReasons = [
      {
        kind: "dependency",
        path: stylesheet,
        analysis: { status: "matched", selectors: [selectors[slug]] },
      },
    ];
    const reasons = reasonsOf(result, id);
    assert.ok(reasons.every((reason) => reason.kind === "dependency"));
    assert.deepEqual(resourceReasonSummaries(reasons), expectedReasons, id);
    const component = result.components.find((entry) => entry.path === id);
    assert.ok(component, id);
    assert.equal("sharedImpact" in component, false);
    assert.deepEqual(
      component.variants.map(({ path }) => path).sort(),
      variants.map((variant) => `${id}/${variant}`).sort(),
      id,
    );
    for (const variant of component.variants) {
      assert.ok(variant.views.length, variant.path);
      if (unmatchedVariants.has(variant.path)) {
        assert.equal(variant.state, "unchanged", variant.path);
        assert.equal(variant.views.length, 2, variant.path);
        for (const view of variant.views) {
          assert.equal(view.state, "unchanged", variant.path);
          assert.equal(view.reasons, undefined, variant.path);
        }
      } else {
        const reasons = reasonsOf(result, variant.path);
        assert.ok(reasons.every((reason) => reason.kind === "dependency"));
        assert.deepEqual(
          resourceReasonSummaries(reasons),
          expectedReasons,
          variant.path,
        );
        assert.equal(variant.state, "changed", variant.path);
        for (const view of variant.views) {
          assert.equal(view.state, "changed", variant.path);
          const viewReasons = view.reasons;
          assert.ok(viewReasons?.length, variant.path);
          assert.ok(
            viewReasons.every(
              (reason) =>
                reason.kind === "dependency" &&
                reason.analysis?.status === "matched",
            ),
            variant.path,
          );
          assert.deepEqual(
            resourceReasonSummaries(
              viewReasons.filter((reason) => reason.path === stylesheet),
            ),
            expectedReasons,
            variant.path,
          );
          if (slug === "top-bar") {
            const nested = [
              ["chrome", "appearance-selector"],
              ...(variant.path === `${id}/tag-picker`
                ? ([
                    ["controls", "tag-chip"],
                    ["controls", "tag-picker"],
                  ] as const)
                : []),
            ] as const;
            assert.deepEqual(
              resourceReasonSummaries(
                viewReasons.filter((reason) => reason.path !== stylesheet),
              ),
              nested.map(([group, slug]) => ({
                kind: "dependency",
                path: libraryStylesheetPath(group, slug),
                analysis: {
                  status: "matched",
                  selectors: [selectors[slug]],
                },
              })),
              `${variant.path}: nested render evidence stays in the view`,
            );
          }
        }
      }
    }
    const consumers = manifestScreenConsumers(fixture.before.manifest, id);
    assert.notDeepEqual(
      consumers,
      [],
      "every shared component has real screen consumers",
    );
    assert.deepEqual(screenConsumersOf(result, id), consumers);
  }
  assertTagChipEvidence(result);

  await t.test(
    "tag-chip single-change control agrees with the grouped pass",
    async () => {
      await fixture.reset();
      const id = "design/library/controls/tag-chip";
      await fixture.edit(
        libraryStylesheetPath("controls", "tag-chip"),
        (source) =>
          source + `\n${selectors["tag-chip"]} { outline-width: 3px; }\n`,
      );
      const control = await fixture.compare();
      const variants = ["default", "selected", "inactive"];
      const expected = [id, ...variants.map((variant) => `${id}/${variant}`)];
      assert.deepEqual(changedEntryPaths(control), expected.sort());
      assert.deepEqual(impactingIds(control), [id]);
      const consumers = manifestScreenConsumers(fixture.before.manifest, id);
      assert.notDeepEqual(consumers, []);
      assert.deepEqual(screenConsumersOf(control, id), consumers);
      assert.deepEqual(
        screenConsumersOf(control, id),
        screenConsumersOf(result, id),
      );
      assert.deepEqual(reasonsOf(control, id), reasonsOf(result, id));
      assertTagChipEvidence(control);
      const topBar = "design/library/chrome/top-bar";
      assert.deepEqual(
        usageChainsOf(control, id, topBar),
        usageChainsOf(result, id, topBar),
      );
    },
  );
});

function assertTagChipEvidence(result: ReviewResultV6): void {
  const id = "design/library/controls/tag-chip";
  const topBar = "design/library/chrome/top-bar";
  assert.deepEqual(usageVariantsOf(result, id, topBar), [
    `${topBar}/tag-picker`,
  ]);
  assert.deepEqual(usageChainsOf(result, id, topBar), [
    [topBar, "design/library/controls/tag-picker", id],
    ["design/library/controls/tag-picker", id],
  ]);
}
