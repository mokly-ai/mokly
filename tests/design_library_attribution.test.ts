import assert from "node:assert/strict";
import test from "node:test";

import { compareReview } from "../dist/review/compare.js";
import { computeChangedPaths } from "../dist/server/changed.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { designLibrary } from "./helpers/design_library.js";
import { designLibraryFixture } from "./helpers/design_library_fixture.js";

test("each exclusive library stylesheet changes its component and only affects real consumers", async (t) => {
  const fixture = await designLibraryFixture(t);
  for (const [group, slug] of designLibrary)
    await t.test(slug, async () => {
      await fixture.reset();
      await fixture.edit(
        `examples/basic/generated/design-library/${group}/${slug}.css`,
        (source) => source + "\nbody { outline-width: 3px; }\n",
      );
      const result = await fixture.compare();
      assert.deepEqual(
        result.changes.map((change) => (change.after ?? change.before)!.path),
        [`design/library/${group}/${slug}`],
      );
      const consumers = fixture.before.manifest.entries
        .flatMap((entry) =>
          entry.kind === "screen" &&
          generatedViews(entry).some((view) =>
            view.usage?.instances.some(
              (instance) =>
                instance.componentId === `design/library/${group}/${slug}`,
            ),
          )
            ? [entry.path]
            : [],
        )
        .sort();
      assert.ok(
        consumers.length > 0,
        "every shared component has real screen consumers",
      );
      assert.deepEqual(
        result.affectedConsumers
          .flatMap((affected) =>
            affected.consumer.kind === "screen" ? [affected.consumer.path] : [],
          )
          .sort(),
        consumers,
      );
      if (slug === "tag-chip") {
        const topBar = result.affectedConsumers.find(
          (affected) =>
            affected.consumer.kind === "component" &&
            affected.consumer.path === "design/library/chrome/top-bar",
        );
        assert.ok(topBar);
        const variants = topBar.evidence.flatMap((evidence) =>
          evidence.context.kind === "component" &&
          evidence.context.entry.path === "design/library/chrome/top-bar"
            ? [evidence.context.variantPath]
            : [],
        );
        assert.deepEqual(
          [...new Set(variants)],
          ["design/library/chrome/top-bar/tag-picker"],
        );
        assert.ok(
          topBar.evidence.some(
            (evidence) =>
              evidence.via.map((item) => item.componentId).join("/") ===
              "design/library/chrome/top-bar/design/library/controls/tag-picker/design/library/controls/tag-chip",
          ),
        );
      }
    });
});

test("the committed catalogue uses one baseline view batch and agrees across Serve and comparison", async (t) => {
  const fixture = await designLibraryFixture(t, "committed");
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
    expected.changes.map((change) => (change.after ?? change.before)!.path),
  );
  const viewBatches = fixture.batches.filter((files) =>
    files.some((file) => file.endsWith(".html")),
  );
  assert.equal(viewBatches.length, 1);
  assert.equal(
    viewBatches[0]!.length,
    fixture.before.manifest.entries.flatMap(generatedViews).length,
  );
  assert.ok(viewBatches[0]!.length > 200);
  const resourceReads = fixture.batches
    .filter((files) => files !== viewBatches[0])
    .flat();
  assert.equal(
    new Set(resourceReads).size,
    resourceReads.length,
    "shared resources are read once, never once per consumer",
  );
  const availableResources = new Set(
    [
      ...fixture.resources.keys(),
      ...[...fixture.before.outputs]
        .filter(
          ([route, content]) =>
            route.startsWith("mokly-generated/") || typeof content !== "string",
        )
        .map(([route]) => route),
    ].map((route) => `examples/basic/generated/${route}`),
  );
  assert.ok(resourceReads.length <= availableResources.size);
  for (const file of resourceReads)
    assert.ok(availableResources.has(file), file);
  const { result } = await compareReview(after, fixture.config, git, "main");
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion === 5) {
    assert.deepEqual(result.changes, expected.changes);
    assert.deepEqual(result.affectedConsumers, expected.affectedConsumers);
  }
});
