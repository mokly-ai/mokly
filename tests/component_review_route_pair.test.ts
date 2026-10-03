import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { parseReviewResult } from "../packages/viewer/dist/data.js";

import {
  assertFastPathEquivalent,
  classifyFixtureWithSources,
  compilationFiles,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const resource = "mockups/shared.svg";
const image = '<img src="../../shared.svg" />';
const svg = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="${fill}"/></svg>`;

test("non-identity metadata cannot split one screen id's view evidence", async (t) => {
  const fixture = await createFixture(source([screen("a", "Before", image)]));
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "shared.svg"), svg("red"));
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await fs.writeFile(fixture.entryPath, source([screen("a", "After", image)]));
  const after = await compileCatalogue(config);
  const result = await assertFastPathEquivalent({
    before: before.manifest,
    after: after.manifest,
    beforeFiles: compilationFiles(before, { "shared.svg": svg("red") }),
    afterFiles: compilationFiles(after, { "shared.svg": svg("blue") }),
    changedPaths: [resource],
    config,
  });
  const paired = result.screens.find((entry) => entry.id === "a")!;
  assert.equal(paired.before?.id, "a");
  assert.equal(paired.after?.id, "a");
  assert.equal(result.screens.length, 1);
  assert.ok(
    paired.views.some((view) =>
      view.reasons?.some((reason) => reason.path === resource),
    ),
  );
  assert.ok(
    result.changes.some(
      (entry) =>
        entry.kind === "screen" &&
        entry.after?.id === "a" &&
        entry.reasons.some(
          (reason) => reason.kind === "dependency" && reason.path === resource,
        ),
    ),
  );
});

test("classification drops a baseline entry whose id changed kind", async (t) => {
  const beforeSource = componentEntrySource();
  const fixture = await componentReviewFixture(
    t,
    (value) =>
      value
        .replace('id: "action", title: "Action"', 'id: "home", title: "Action"')
        .replace('id: "home", title: "Home"', 'id: "new-home", title: "Home"')
        .replaceAll('"action-default"', '"home-default"')
        .replaceAll('"action-disabled"', '"home-disabled"')
        .replaceAll('to="action"', 'to="home"'),
    beforeSource,
  );
  const classified = await classifyFixtureWithSources({
    before: fixture.before.manifest,
    after: fixture.after.manifest,
    beforeFiles: compilationFiles(fixture.before),
    afterFiles: compilationFiles(fixture.after),
    changedPaths: fixture.changedPaths,
    config: fixture.config,
  });
  const reused = classified.result.changes.filter(
    (entry) => (entry.after ?? entry.before)?.id === "home",
  );

  assert.deepEqual(
    reused.map((entry) => [
      entry.kind,
      Boolean(entry.before),
      Boolean(entry.after),
    ]),
    [["component", false, true]],
  );
  assert.deepEqual(parseReviewResult(classified.result), classified.result);
});

function source(screens: readonly string[]): string {
  const parts = componentEntrySource().split("\n  defineScreen(");
  assert.equal(parts.length, 2);
  return `${parts[0]}\n  ${screens.join(",\n  ")}\n];`;
}

function screen(id: string, title: string, body: string): string {
  return `defineScreen({ ...metadata, id: "${id}", title: "${title}", description: "A screen", navPath: ["Fixture"], mobile: <main>${body}</main>, desktop: <main>${body}</main> })`;
}
