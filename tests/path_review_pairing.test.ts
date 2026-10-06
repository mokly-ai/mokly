import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ManifestDocument, ManifestV8 } from "@mokly/viewer/data";
import { parseReviewResult } from "@mokly/viewer/data";

import { entryChanges } from "../packages/mokly/dist/catalogue/changes.js";
import { exportCatalogue } from "../packages/mokly/dist/export/run.js";
import { removedManifestEntries } from "../packages/mokly/dist/registry/changes.js";
import { compareReview } from "../packages/mokly/dist/review/compare.js";
import { classifyComponents } from "../packages/mokly/dist/review/component_classification.js";
import { entryPairs } from "../packages/mokly/dist/review/component_metadata.js";
import { createCatalogue } from "../packages/viewer/src/shell/catalogue.js";
import { workspaceData } from "../packages/viewer/src/shell/workspace_data.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { createExportFixture } from "./helpers/export_fixture.js";
import { pageSource } from "./helpers/path_fixture.js";

const screen = (path: string) =>
  `import {defineScreen} from '@mokly/mokly';export default defineScreen({path:'${path}',title:'Billing',description:'Billing',dependencies:[],relatedDocs:[],mobile:'Billing',desktop:'Billing'});`;
const component = (parent: string, variant: string) =>
  `import {defineComponent} from '@mokly/mokly';export default defineComponent({path:'${parent}',title:'Component',description:'Component',dependencies:[],relatedDocs:[],propSchema:{kind:'object',properties:{}},render:()=> 'Control',variants:[{slug:'${variant}',title:'State',props:{}}]});`;

for (const reversed of [false, true])
  test(`component parent and variant at one path have one Changed record (${reversed})`, async (t) => {
    const before = component("holder/item", "saved"),
      after = component("holder", "item");
    const fixture = await componentReviewFixture(
      t,
      () => (reversed ? before : after),
      reversed ? after : before,
    );
    const { result } = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    assert.doesNotThrow(() => parseReviewResult(result));
    const changes = result.changes.filter(
      (change) => (change.after ?? change.before)?.path === "holder/item",
    );
    assert.equal(changes.length, 1);
    assert.equal(changes[0]?.before?.path, "holder/item");
    assert.equal(changes[0]?.after?.path, "holder/item");
    assert.ok(changes[0]?.reasons.some((reason) => reason.kind === "metadata"));
    assert.ok(
      changes[0]?.reasons.every(
        (reason) => reason.kind !== "added" && reason.kind !== "removed",
      ),
    );
  });

for (const kind of ["screen", "component"] as const)
  test(`case-only ${kind} path changes preserve pairing and removal identity`, async (t) => {
    const source =
      kind === "screen" ? screen("Billing") : component("Billing", "State");
    const fixture = await componentReviewFixture(
      t,
      (s) =>
        s
          .replaceAll("path:'Billing'", "path:'billing'")
          .replaceAll("Billing/State", "billing/State"),
      source,
    );
    const pairs = entryPairs(fixture.before.manifest, fixture.after.manifest);
    assert.ok(pairs.every((pair) => pair.before && pair.after));
    assert.deepEqual(
      removedManifestEntries(fixture.after.manifest, fixture.before.manifest),
      [],
    );
    const { result } = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    assert.ok(result.changes.every((change) => change.before && change.after));
    assert.ok(result.screens.every((item) => item.state === "unchanged"));
  });

test("kind changes are Added in catalogue projection and workspace evidence", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    () => screen("item"),
    pageSource('path:"item",'),
  );
  const entry = fixture.after.manifest.entries[0]!;
  assert.equal(entry.kind, "screen");
  if (entry.kind !== "screen") return;
  const catalogue = createCatalogue(fixture.after.manifest);
  const evidence = {
    baseline: fixture.before.manifest,
    changedEntries: ["item"],
    comparison: {
      baseCommit: "a".repeat(40),
      baseRef: "main",
      changedPaths: [],
      headDigests: {},
    },
  };
  assert.deepEqual(
    entryChanges(
      entry,
      {
        catalogue,
        configPath: "mokly.config.ts",
        changesStatus: "ready",
        comparisonUrl: null,
        revision: { content: 1, evidence: 1 },
        evidence,
      },
      false,
    ),
    { status: "ready", kind: "added", included: true },
  );
  assert.equal(
    workspaceData(
      catalogue,
      { base: "main", updateVersion: 1, componentChanges: evidence },
      entry,
    ).status,
    "Added",
  );
});

test("reserved documents are not component review pairs", async (t) => {
  const fixture = await componentReviewFixture(t, (s) => s, screen("item"));
  const document: ManifestDocument = {
    kind: "document",
    path: "guide",
    title: "Guide",
    description: "",
    colorSchemes: ["light"],
    sourcePath: "specs/guide.md",
    declaredDependencies: [],
    relatedDocs: [],
    resources: [],
  };
  const manifest: ManifestV8 = {
    schemaVersion: 8,
    generatedBy: "mokly",
    folders: [],
    sourceFiles: ["specs/guide.md"],
    entries: [document],
  };
  assert.deepEqual(entryPairs(manifest, manifest), []);
  const reader = {
    read: async () => {
      throw new Error("reserved documents have no compiled views");
    },
  };
  const result = await classifyComponents({
    before: manifest,
    after: manifest,
    beforeReader: reader,
    afterReader: reader,
    config: fixture.config,
    changedPaths: [],
    baseCommit: "a".repeat(40),
    baseRef: "main",
  });
  assert.deepEqual(result.changes, []);
});

for (const kind of ["page", "screen"] as const)
  test(`Changes-enabled export handles a case-only ${kind} path rename`, async (t) => {
    const before =
      kind === "page" ? pageSource('path:"Billing",') : screen("Billing");
    const fixture = await createExportFixture(before);
    t.after(fixture.close);
    const after = before
      .replace('path:"Billing"', 'path:"billing"')
      .replace("path:'Billing'", "path:'billing'");
    assert.notEqual(after, before);
    await fs.writeFile(fixture.entryPath, after);
    await exportCatalogue(fixture.config, { outDir: "site", base: "HEAD" });
    const model = JSON.parse(
      await fs.readFile(
        path.join(fixture.output, "__mokly/catalogue.json"),
        "utf8",
      ),
    );
    assert.equal(model.changesStatus, "ready");
    assert.deepEqual(model.removedEntries, []);
    assert.ok(
      (
        await fs.stat(path.join(fixture.output, "view/billing/index.html"))
      ).isFile(),
    );
  });
