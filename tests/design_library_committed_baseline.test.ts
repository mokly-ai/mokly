import assert from "node:assert/strict";
import test from "node:test";

import { compareReview } from "../dist/review/compare.js";
import { computeChangedPaths } from "../dist/server/changed.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { changedEntryPaths } from "./helpers/attribution_result.js";
import { designLibraryFixture } from "./helpers/design_library_fixture.js";

test("the committed catalogue uses one baseline view batch and agrees across Serve and comparison", async (t) => {
  const fixture = await designLibraryFixture(t);
  const file = "examples/basic/specs/design/library/controls/tag-chip.view.tsx";
  await fixture.edit(file, (source) =>
    source.replace("{label}", "{label} revised"),
  );
  const after = await fixture.build();
  await fixture.write(after);
  const git = fixture.git([file]);
  const expected = await fixture.compare(after);
  assert.deepEqual(
    await computeChangedPaths(fixture.config, "main", git),
    changedEntryPaths(expected),
  );
  const viewBatches = fixture.batches.filter((files) =>
    files.some((file) => file.endsWith(".html")),
  );
  assert.equal(viewBatches.length, 1);
  const [viewBatch] = viewBatches;
  assert.ok(viewBatch);
  assert.equal(
    viewBatch.length,
    fixture.before.manifest.entries.flatMap(generatedViews).length,
  );
  assert.ok(viewBatch.length > 200);
  const resourceReads = fixture.batches
    .filter((files) => !viewBatches.includes(files))
    .flat();
  assert.equal(
    new Set(resourceReads).size,
    resourceReads.length,
    "shared resources are read once, never once per consumer",
  );
  const availableResources = new Set([
    ...[...fixture.resources.keys()].map((route) => `examples/basic/${route}`),
    ...fixture.before.manifest.generatedFiles
      .filter(({ path }) => !path.endsWith(".html"))
      .map(({ path }) => `examples/basic/mokly-generated/${path}`),
  ]);
  assert.ok(resourceReads.length <= availableResources.size);
  for (const file of resourceReads)
    assert.ok(availableResources.has(file), file);
  const { result } = await compareReview(after, fixture.config, git, "main");
  assert.equal(result.schemaVersion, 7);
  if (result.schemaVersion === 7) {
    assert.deepEqual(result.changes, expected.changes);
    assert.deepEqual(result.affectedConsumers, expected.affectedConsumers);
  }
});
