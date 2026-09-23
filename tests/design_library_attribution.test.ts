import assert from "node:assert/strict";
import test from "node:test";

import { compareReview } from "../dist/review/compare.js";
import { computeChangedRoutes } from "../dist/server/changed.js";
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
        result.changes.map((change) => (change.after ?? change.before)!.id),
        [`design-ui-${slug}`],
      );
      const consumers = fixture.before.manifest.entries
        .flatMap((entry) =>
          entry.kind === "screen" &&
          generatedViews(entry).some((view) =>
            view.usage?.instances.some(
              (instance) => instance.componentId === `design-ui-${slug}`,
            ),
          )
            ? [entry.route]
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
            affected.consumer.kind === "screen"
              ? [affected.consumer.route]
              : [],
          )
          .sort(),
        consumers,
      );
      if (slug === "tag-chip") {
        const topBar = result.affectedConsumers.find(
          (affected) =>
            affected.consumer.kind === "component" &&
            affected.consumer.id === "design-ui-top-bar",
        );
        assert.ok(topBar);
        const variants = topBar.evidence.flatMap((evidence) =>
          evidence.context.kind === "component" &&
          evidence.context.entry.id === "design-ui-top-bar"
            ? [evidence.context.variantId]
            : [],
        );
        assert.deepEqual([...new Set(variants)], ["tag-picker"]);
        assert.ok(
          topBar.evidence.some(
            (evidence) =>
              evidence.via.map((item) => item.componentId).join("/") ===
              "design-ui-top-bar/design-ui-tag-picker/design-ui-tag-chip",
          ),
        );
      }
    });
});

test("the committed catalogue uses one baseline view batch and agrees across Serve and comparison", async (t) => {
  const fixture = await designLibraryFixture(t, "committed");
  const file =
    "examples/basic/entries/design/library/controls/tag-chip.view.tsx";
  await fixture.edit(file, (source) =>
    source.replace("{label}", "{label} revised"),
  );
  const after = await fixture.build();
  await fixture.write(after);
  const git = fixture.git([file]);
  const expected = await fixture.compare(after);
  assert.deepEqual(
    await computeChangedRoutes(fixture.config, "main", git),
    expected.changes.map((change) => (change.after ?? change.before)!.route),
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
  assert.ok(resourceReads.length <= fixture.resources.size);
  const { result } = await compareReview(after, fixture.config, git, "main");
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion === 3) {
    assert.deepEqual(result.changes, expected.changes);
    assert.deepEqual(result.affectedConsumers, expected.affectedConsumers);
  }
});
