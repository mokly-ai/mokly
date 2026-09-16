import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyComponents } from "../dist/review/component_classification.js";
import {
  ComponentDependencyPolicy,
  metadata,
  type RoutedEntry,
} from "../dist/review/component_metadata.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import type { ReadOnlyReviewRepository } from "../dist/review/repository.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";
import { computeChangedRoutes } from "../dist/server/changed.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";
import { analyzeHierarchy } from "../packages/viewer/dist/registry/hierarchy.js";
import type { Manifest } from "../packages/viewer/dist/registry/types.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

test("component metadata reuses a precomputed catalogue hierarchy", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const manifest = fixture.after.manifest;
  assert.equal(manifest.schemaVersion, 5);
  let traversals = 0;
  const entries = new Proxy(manifest.entries, {
    get(target, property, receiver) {
      if (property !== Symbol.iterator)
        return Reflect.get(target, property, receiver);
      return function* () {
        traversals += 1;
        yield* target;
      };
    },
  });
  const tracked = { ...manifest, entries };
  const hierarchy = analyzeHierarchy(manifest.entries).hierarchy;
  const project = metadata as unknown as (
    entry: RoutedEntry,
    manifest: Manifest,
    hierarchy: ReturnType<typeof analyzeHierarchy>["hierarchy"],
  ) => string;

  for (const entry of manifest.entries) {
    if (entry.kind !== "collection" && entry.kind !== "page")
      project(entry, tracked, hierarchy);
  }

  assert.equal(traversals, 0);
});

test("component dependency ownership is indexed once per changed path", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const sourceManifest = fixture.after.manifest;
  assert.equal(sourceManifest.schemaVersion, 5);
  let ownershipReads = 0;
  const entries = sourceManifest.entries.map((entry) =>
    entry.kind === "component"
      ? new Proxy(entry, {
          get(target, property, receiver) {
            if (property === "ownedDependencies") ownershipReads += 1;
            return Reflect.get(target, property, receiver);
          },
        })
      : entry,
  );
  const manifest = { ...sourceManifest, entries };
  const policy = new ComponentDependencyPolicy(manifest, manifest, []);
  const screen = entries.find((entry) => entry.kind === "screen");
  assert.ok(screen);
  const changedPaths = Array.from(
    { length: 24 },
    (_, index) => `src/component-${index}.tsx`,
  );

  policy.reasons(screen, screen, changedPaths);
  const firstPassReads = ownershipReads;
  policy.reasons(screen, screen, changedPaths);

  assert.ok(firstPassReads > 0);
  assert.equal(ownershipReads, firstPassReads);
});

test("component views validate each retained document range index once", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const screen = fixture.after.manifest.entries.find(
    (entry) => entry.kind === "screen",
  );
  assert.ok(screen);
  const view = generatedViews(screen)[0];
  assert.ok(view?.usage);
  let validations = 0;
  const ranges = new Proxy(view.usage.ranges, {
    get(target, property, receiver) {
      if (property === "map") validations += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  const observed = { ...view, usage: { ...view.usage, ranges } };
  const reader = new ComponentMaterialReader({
    read: async (route) => Buffer.from(fixture.after.outputs.get(route) ?? ""),
  });

  await compareComponentView(
    {
      beforeReader: reader,
      afterReader: reader,
      dependencies: new ComponentDependencyPolicy(
        fixture.after.manifest,
        fixture.after.manifest,
        [],
      ),
      changed: new Set(),
      prefix: "mockups",
      resources: new ResourceComparison(reader, reader, new Set(), "mockups"),
    },
    observed,
    observed,
  );

  assert.equal(validations, 2);
});

for (const baseline of ["screens", "components"] as const)
  test(`Serve batches every baseline view when adopting or updating components: ${baseline}`, async (t) => {
    const source = componentEntrySource();
    const fixture = await componentReviewFixture(
      t,
      () =>
        source.replace(
          "<button data-viewport=",
          '<button className="changed" data-viewport=',
        ),
      baseline === "screens" ? validEntrySource() : source,
    );
    const batches: string[][] = [];
    const git: ReadOnlyReviewRepository = {
      ...fixture.git,
      reader: {
        ...fixture.git.reader,
        readFiles: async (commit, paths) => {
          batches.push([...paths]);
          return new Map(
            await Promise.all(
              paths.map(
                async (route) =>
                  [
                    route,
                    {
                      kind: "regular" as const,
                      bytes: await fixture.git.reader.readFileBytes(
                        commit,
                        route,
                      ),
                    },
                  ] as const,
              ),
            ),
          );
        },
      },
    };
    const expected = await computeChangedRoutes(
      fixture.config,
      "main",
      fixture.git,
    );
    assert.ok(expected);

    assert.deepEqual(
      await computeChangedRoutes(fixture.config, "main", git),
      expected,
    );
    const paths = fixture.before.manifest.entries.flatMap((entry) =>
      generatedViews(entry).map((view) => `mockups/${view.path}`),
    );
    assert.ok(paths.length >= 8);
    assert.equal(
      batches.length,
      1,
      "one logical Git batch for all saved views",
    );
    assert.deepEqual(batches[0], [...new Set(paths)].sort());
  });

test("shared classification batches both sides including removed dark variants", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source.replace(
      ', { id: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
      "",
    ),
  );
  const readers = [fixture.before, fixture.after].map((compilation) => {
    const batches: string[][] = [];
    const reads: string[] = [];
    const read = async (route: string) => {
      const html = compilation.outputs.get(route);
      assert.notEqual(html, undefined, route);
      return Buffer.from(html!);
    };
    return {
      batches,
      reads,
      plain: { read },
      batched: {
        read: async (route: string) => {
          reads.push(route);
          return read(route);
        },
        readMany: async (routes: readonly string[]) => {
          batches.push([...routes]);
          return new Map(
            await Promise.all(
              routes.map(async (route) => [route, await read(route)] as const),
            ),
          );
        },
      },
    };
  });
  const [before, after] = readers;
  assert.ok(before && after);
  const input = {
    before: fixture.before.manifest,
    after: fixture.after.manifest,
    config: fixture.config,
    changedPaths: fixture.changedPaths,
    baseCommit: "a".repeat(40),
    baseRef: "main",
  };
  const expected = await classifyComponents({
    ...input,
    beforeReader: before.plain,
    afterReader: after.plain,
  });

  assert.deepEqual(
    await classifyComponents({
      ...input,
      beforeReader: before.batched,
      afterReader: after.batched,
    }),
    expected,
  );
  for (const [index, compilation] of [
    fixture.before,
    fixture.after,
  ].entries()) {
    const reader = readers[index]!;
    const paths = compilation.manifest.entries.flatMap((entry) =>
      generatedViews(entry).map((view) => view.path),
    );
    assert.equal(reader.batches.length, 1);
    assert.deepEqual(
      [...reader.batches[0]!].sort(),
      [...new Set(paths)].sort(),
    );
    assert.deepEqual(reader.reads, [], "prefetched fragments must stay cached");
  }
  assert.equal(
    expected.components.find((entry) => entry.id === "action")?.variants[1]
      ?.state,
    "removed",
  );
});
