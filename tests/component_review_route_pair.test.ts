import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import {
  assertFastPathEquivalent,
  compilationFiles,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const resource = "mockups/shared.svg";
const image = '<img src="../shared.svg" />';
const svg = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="${fill}"/></svg>`;

test("a moved screen shares an id with a removed pair without losing view evidence", async (t) => {
  const fixture = await createFixture(
    source([screen("a", "a", image), screen("b", "b", "<p>Before B</p>")]),
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "shared.svg"), svg("red"));
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await fs.writeFile(fixture.entryPath, source([screen("b", "a", image)]));
  const after = await compileCatalogue(config);
  const result = await assertFastPathEquivalent({
    before: before.manifest,
    after: after.manifest,
    beforeFiles: compilationFiles(before, { "shared.svg": svg("red") }),
    afterFiles: compilationFiles(after, { "shared.svg": svg("blue") }),
    changedPaths: [resource],
    config,
  });
  const moved = result.screens.find(
    (entry) => entry.route === "screens/a.html",
  )!;
  const removed = result.screens.find(
    (entry) => entry.route === "screens/b.html",
  )!;
  assert.equal(moved.before?.id, "a");
  assert.equal(moved.after?.id, "b");
  assert.equal(removed.before?.id, "b");
  assert.equal(removed.after, undefined);
  assert.ok(
    moved.views.some((view) =>
      view.reasons?.some((reason) => reason.path === resource),
    ),
  );
  assert.ok(
    removed.views.every(
      (view) => !view.reasons?.some((reason) => reason.path === resource),
    ),
  );
  assert.ok(
    result.changes.some(
      (entry) =>
        entry.kind === "screen" &&
        entry.after?.route === "screens/a.html" &&
        entry.reasons.some(
          (reason) => reason.kind === "dependency" && reason.path === resource,
        ),
    ),
  );
});

function source(screens: readonly string[]): string {
  const parts = componentEntrySource().split("\n  defineScreen(");
  assert.equal(parts.length, 2);
  return `${parts[0]}\n  ${screens.join(",\n  ")}\n];`;
}

function screen(id: string, route: string, body: string): string {
  return `defineScreen({ ...metadata, id: "${id}", title: "${id}", description: "A screen", route: "screens/${route}.html", navPath: ["Fixture"], mobile: <main>${body}</main>, desktop: <main>${body}</main> })`;
}
