import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { structureSignals } from "../dist/components/comparison_material.js";
import { loadConfig } from "../dist/config/load.js";
import { compareReview } from "../dist/review/compare.js";
import { computeChangedRoutes } from "../dist/server/changed.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  componentGit,
  componentReviewFixture,
} from "./helpers/component_review_fixture.js";
import { componentViews, screenView } from "./helpers/component_views.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("Changes structure projections exclude invocation source for every input owner", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const before = screenView(fixture.before);
  const after = structuredClone(before);
  for (const instance of after.instances)
    Object.assign(instance, {
      source: { path: "moved.tsx", line: 9, column: 1 },
    });
  for (const owner of [
    { kind: "entry" } as const,
    ...before.instances.map((instance) => instance.owner),
  ])
    assert.deepEqual(
      structureSignals(before, owner),
      structureSignals(after, owner),
    );
});

test("line and column shifts alone preserve bytes, keys and all Changes results", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    (source) =>
      "\n\n" +
      source
        .split("\n")
        .map((line) => "   " + line)
        .join("\n"),
  );
  const before = componentViews(fixture.before.manifest);
  const after = componentViews(fixture.after.manifest);
  assert.ok(
    before
      .flatMap((view) => view.instances)
      .every((instance) => instance.source),
  );
  assert.notDeepEqual(before, after);
  const withoutSource = (views: typeof before) =>
    views.map((view) => ({
      ...view,
      instances: view.instances.map(
        ({ source: _source, ...instance }) => instance,
      ),
    }));
  assert.deepEqual(withoutSource(before), withoutSource(after));
  for (const [route, html] of fixture.before.outputs)
    if (route.endsWith(".html"))
      assert.equal(fixture.after.outputs.get(route), html, route);
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion !== 3) return;
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.affectedConsumers, []);
  assert.deepEqual(
    await computeChangedRoutes(fixture.config, "main", fixture.git),
    [],
  );
});

test("moving an invocation source file alone does not create material Changes", async (t) => {
  const source = componentEntrySource({
    extra: 'import { Content } from "./content.js";',
    body: "<Content Action={action.Component} />",
  });
  const fixture = await createFixture(source);
  t.after(() => removeFixture(fixture));
  const content = path.join(fixture.entriesDir, "content.tsx");
  await fs.writeFile(
    content,
    'export const Content = ({ Action }) => <Action label="Continue" />;',
  );
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await fs.mkdir(path.join(fixture.entriesDir, "nested"));
  await fs.rename(content, path.join(fixture.entriesDir, "nested/content.tsx"));
  await fs.writeFile(
    fixture.entryPath,
    source.replace("./content.js", "./nested/content.js"),
  );
  const after = await compileCatalogue(config);
  await writeCompilation(after, config);
  const invocation = (compilation: typeof before) =>
    screenView(compilation).instances.find((item) => item.id === "action")!;
  assert.equal(invocation(before).source?.path, "entries/content.tsx");
  assert.equal(invocation(after).source?.path, "entries/nested/content.tsx");
  const git = componentGit(before, [
    "entries/fixture.mockup.tsx",
    "entries/content.tsx",
    "entries/nested/content.tsx",
  ]);
  const { result } = await compareReview(after, config, git, "main");
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion !== 3) return;
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.affectedConsumers, []);
  assert.deepEqual(await computeChangedRoutes(config, "main", git), []);
});
