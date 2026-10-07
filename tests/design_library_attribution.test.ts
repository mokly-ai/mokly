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
import { designLibrary } from "./helpers/design_library.js";
import { designLibraryFixture } from "./helpers/design_library_fixture.js";
import {
  libraryStylesheetMarker,
  libraryStylesheetPath,
} from "./helpers/design_stylesheets.js";
import { fileFixture } from "./helpers/file_fixture.js";

const sharedFixture = fileFixture((owner) => designLibraryFixture(owner));

test("library stylesheets attribute only to their own component in one pass", async (t) => {
  const fixture = await sharedFixture();
  await fixture.reset();
  for (const [group, slug] of designLibrary)
    await fixture.edit(
      libraryStylesheetPath(group, slug),
      (source) => source + libraryStylesheetMarker,
    );
  const result = await fixture.compare();
  const ids = designLibrary
    .map(([group, slug]) => `design/library/${group}/${slug}`)
    .sort();
  assert.deepEqual(changedEntryPaths(result), ids);
  assert.deepEqual(impactingIds(result), ids);
  for (const [group, slug] of designLibrary) {
    const id = `design/library/${group}/${slug}`;
    const stylesheet = libraryStylesheetPath(group, slug);
    assert.deepEqual(reasonsOf(result, id), [
      {
        kind: "dependency",
        path: stylesheet,
        analysis: { status: "unresolved", selectors: ["body"] },
      },
    ]);
    const component = result.components.find((entry) => entry.path === id);
    assert.ok(component, id);
    assert.deepEqual(component.sharedImpact, [stylesheet]);
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
        (source) => source + libraryStylesheetMarker,
      );
      const control = await fixture.compare();
      assert.deepEqual(changedEntryPaths(control), [id]);
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
