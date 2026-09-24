import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConsumerGraph } from "../dist/build/load_graph.js";
import { loadConfig } from "../dist/config/load.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { prepareRegistry } from "../dist/registry/prepare.js";

import { generateLargeFixture, largeSize } from "./fixtures/large/generate.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("large fixture validates dimensions and defaults to high-scale routes", () => {
  assert.deepEqual(largeSize({}), {
    areas: 30,
    screens: 40,
    rows: 12,
    stylesheets: 4,
    stylesheetShare: 0.5,
  });
  for (const value of [0, -1, 1.5, NaN, Infinity])
    assert.throws(() => largeSize({ areas: value }), /positive integer/);
  assert.throws(() => largeSize({ screens: 1 }), /at least two/);
  for (const value of [-1, 1.5, NaN, Infinity])
    assert.throws(
      () => largeSize({ stylesheets: value }),
      /non-negative integer/,
    );
  for (const value of [-0.1, 1.1, NaN, Infinity])
    assert.throws(
      () => largeSize({ stylesheetShare: value }),
      /between 0 and 1/,
    );
  assert.equal(largeSize({ stylesheets: 0 }).stylesheets, 0);
  assert.equal(largeSize({ stylesheetShare: 0 }).stylesheetShare, 0);
  assert.equal(largeSize({ stylesheetShare: 1 }).stylesheetShare, 1);
});

for (const screens of [10, 11, 20, 21]) {
  test(`large fixture keeps collection ownership unique at ${screens} screens`, async (t) => {
    const root = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/large-test-"),
    );
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    await generateLargeFixture(root, { areas: 1, screens, rows: 1 });
    const config = await loadConfig(root);
    const graph = await loadConsumerGraph(config);
    const registry = prepareRegistry(graph.definitions, {
      ...config,
      entryModules: graph.entrySources,
      sourceFiles: graph.sourceFiles,
    });
    assert.equal(
      registry.entries.filter((entry) => entry.kind === "screen").length,
      screens,
    );
    assert.ok(
      registry.entries
        .filter((entry) => entry.kind === "use-case")
        .every((entry) => entry.steps.length >= 2),
    );
  });
}

test("scaled consumer exercises the same render, hierarchy, resource and component paths", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/large-test-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fixture = await generateLargeFixture(root, {
    areas: 2,
    screens: 4,
    rows: 3,
  });
  const events: TimingEvent[] = [];
  const config = await loadConfig(root);
  const compilation = await runWithTimings(
    true,
    "test",
    () => compileCatalogue(config),
    {
      write: (event) => events.push(event),
    },
  );
  assert.equal(fixture.routes, 16);
  assert.equal(fixture.documents, 82);
  assert.equal(compilation.outputs.size, fixture.documents + 1);
  assert.equal(compilation.manifest.entries.length, fixture.routes);
  assert.ok(
    compilation.manifest.entries.some((entry) => entry.kind === "page"),
  );
  assert.ok(
    compilation.manifest.entries.some((entry) => entry.kind === "use-case"),
  );
  const screen = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen",
  );
  assert.ok(screen && screen.componentViews?.length === 4);
  assert.ok(
    screen.componentViews.every(
      (view) => view.instances.length >= 4 && view.slots.length > 0,
    ),
  );
  const html = compilation.outputs.get(screen.fragments.desktop)!;
  assert.match(html, /react-native-stylesheet/);
  assert.match(html, /data-mokly-link/);
  assert.match(html, /assets\/mark.svg/);
  assert.ok(
    compilation.manifest.sourceFiles.some((file) =>
      file.endsWith("screens.tsx"),
    ),
  );
  assert.deepEqual(
    (await compileCatalogue(config)).outputs,
    compilation.outputs,
  );
  assert.ok(
    events.some(
      (event) =>
        event.stage === "output" &&
        event.counts?.files === fixture.documents + 1,
    ),
  );
  await assert.rejects(generateLargeFixture(root, {}), /empty directory/);
});
