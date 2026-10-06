import assert from "node:assert/strict";
import test, { after } from "node:test";

import { compareReview } from "../dist/review/compare.js";
import { computeChangedPaths } from "../dist/server/changed.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";
import type { ReviewResultV5 } from "../packages/viewer/dist/data.js";

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

const sharedFixture = designLibraryFixture({ after });

test("library stylesheets attribute only to their own component in one pass", async (t) => {
  const fixture = await sharedFixture;
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

function assertTagChipEvidence(result: ReviewResultV5): void {
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

test("real implementation and saved metadata edits have distinct impact", async (t) => {
  const fixture = await sharedFixture;
  for (const [file, from, to, id, affects] of [
    [
      "chrome/top-bar.view.tsx",
      'className="mbk-topbar"',
      'className="mbk-topbar revised"',
      "chrome/top-bar",
      true,
    ],
    [
      "controls/tag-chip.view.tsx",
      "{label}",
      "{label} revised",
      "controls/tag-chip",
      true,
    ],
    [
      "chrome/top-bar.tsx",
      'title: "Search"',
      'title: "Filtered search"',
      "chrome/top-bar/search",
      false,
    ],
    [
      "chrome/top-bar.tsx",
      'label: "Query"',
      'label: "Search text"',
      "chrome/top-bar",
      false,
    ],
    [
      "chrome/top-bar.tsx",
      'query: "tag:forms"',
      'query: "tag:onboarding"',
      "chrome/top-bar/search",
      false,
    ],
  ] as const)
    await t.test(`${file}: ${from}`, async () => {
      await fixture.reset();
      await fixture.edit(
        `examples/basic/specs/design/library/${file}`,
        (source) => source.replace(from, to),
      );
      const after = await fixture.build();
      const result = await fixture.compare(after);
      assert.deepEqual(changedEntryPaths(result), [`design/library/${id}`]);
      assert.equal(result.affectedConsumers.length > 0, affects);
    });
});

test("real screen inputs, destinations, slots and ordered instances remain screen-owned", async (t) => {
  const fixture = await sharedFixture;
  const file = "examples/basic/specs/design/browse/views/use-case.tsx";
  for (const [label, change] of [
    [
      "title",
      (source: string) =>
        source.replace('title="Example tour"', 'title="Explore the example"'),
    ],
    [
      "destination",
      (source: string) =>
        source.replace(
          "screenPath={DESTINATIONS.welcome}",
          "screenPath={DESTINATIONS.details}",
        ),
    ],
    [
      "slot",
      (source: string) =>
        source.replace(
          "<MiniWelcome />",
          "<MiniWelcome /><p>Continue when ready</p>",
        ),
    ],
    [
      "reorder",
      (source: string) =>
        source.replace(
          /(<FlowStep[\s\S]*?<\/FlowStep>)\s*(<FlowStep[\s\S]*?<\/FlowStep>)/,
          "$2\n$1",
        ),
    ],
    [
      "removal",
      (source: string) => source.replace(/<FlowStep[\s\S]*?<\/FlowStep>/, ""),
    ],
  ] as const)
    await t.test(label, async () => {
      await fixture.reset();
      await fixture.edit(file, change);
      const after = await fixture.build();
      const result = await fixture.compare(after);
      assert.deepEqual(changedEntryPaths(result), [
        "design/browse/views/use-case",
      ]);
      assert.deepEqual(result.affectedConsumers, []);
    });
});

test("screen query and field values remain direct changes in their owning designs", async (t) => {
  const fixture = await sharedFixture;
  for (const [file, from, to, expected] of [
    [
      "browse/states/tags/picker.tsx",
      "design={DESTINATIONS.tagPicker}",
      'design={DESTINATIONS.tagPicker} tag="forms"',
      ["design/browse/views/screen/tag-picker"],
    ],
    [
      "components/controls/parts/fixtures.ts",
      "draft: { ...saved, cornerRadius: 40 }",
      "draft: { ...saved, cornerRadius: 50 }",
      ["design/components/controls/states/invalid"],
    ],
  ] as const)
    await t.test(file, async () => {
      await fixture.reset();
      await fixture.edit(`examples/basic/specs/design/${file}`, (source) =>
        source.replace(from, to),
      );
      const result = await fixture.compare(await fixture.build());
      assert.deepEqual(changedEntryPaths(result), expected);
      assert.deepEqual(result.affectedConsumers, []);
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
    .filter((files) => files !== viewBatch)
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
