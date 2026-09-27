import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  parseHistoricalManifest,
  parseManifest,
} from "../dist/registry/manifest.js";
import { componentReviewManifest } from "../dist/review/component_manifests.js";
import {
  flattenComponentVariantEntries,
  legacyComponentVariantId,
} from "../packages/viewer/dist/data.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const pageSource = `import { definePage } from "@mokly/mokly";
export const mockups = [definePage({ id: "handbook", title: "Handbook", description: "Document", dependencies: [], relatedDocs: [], render: () => "<html><body>Handbook</body></html>" })];`;

test("the current manifest combines pages and complete component usage without legacy roots", async (context) => {
  const fixture = await createFixture(componentEntrySource());
  context.after(() => removeFixture(fixture));
  await fs.writeFile(`${fixture.entriesDir}/handbook.mockup.ts`, pageSource);
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const current = parseManifest(compilation.manifest);
  assert.equal(current.schemaVersion, 7);
  assert.equal("legacyPages" in current, false);
  assert.ok(current.sourceFiles.includes("entries/handbook.mockup.ts"));
  assert.ok(current.entries.some((entry) => entry.kind === "page"));
  assert.ok(current.entries.some((entry) => entry.kind === "component"));
  const screen = current.entries.find((entry) => entry.kind === "screen");
  assert.ok(screen?.componentViews?.every((view) => view.instances.length > 0));
  assert.match(
    compilation.outputs.get("pages/handbook.html") ?? "",
    /Handbook/,
  );
});

test("both disjoint historical v4 formats remain readable only at the Git boundary", async (context) => {
  const componentFixture = await createFixture(componentEntrySource());
  const pageFixture = await createFixture(pageSource);
  context.after(() => removeFixture(componentFixture));
  context.after(() => removeFixture(pageFixture));
  const components = (
    await compileCatalogue(await loadConfig(componentFixture.root))
  ).manifest;
  const pages = (await compileCatalogue(await loadConfig(pageFixture.root)))
    .manifest;
  const componentV4 = {
    schemaVersion: 4,
    generatedBy: "mokly",
    legacyPages: [],
    entries: componentReviewManifest(components).entries,
  };
  const pageV4 = {
    ...pages,
    schemaVersion: 4,
    entries: pages.entries.map(
      ({ declaredDependencies: _declared, ...entry }) => entry,
    ),
  };
  for (const historical of [componentV4, pageV4]) {
    assert.equal(parseHistoricalManifest(historical).schemaVersion, 4);
    assert.throws(() => parseManifest(historical), /schema version 7/);
  }
  assert.throws(() =>
    parseHistoricalManifest({ ...componentV4, sourceFiles: [] }),
  );
  assert.throws(() => parseHistoricalManifest({ ...pageV4, legacyPages: [] }));
  const nestedV7 = {
    ...componentReviewManifest(components),
    schemaVersion: 7 as const,
  };
  assert.equal(parseHistoricalManifest(nestedV7).schemaVersion, 7);
  assert.throws(() => parseManifest(nestedV7));
  const invalidUsage = structuredClone(componentV4);
  const screen = invalidUsage.entries.find((entry) => entry.kind === "screen");
  assert.ok(screen);
  Reflect.deleteProperty(screen, "componentViews");
  assert.throws(() => parseHistoricalManifest(invalidUsage));
});

test("historical component variant ids expand once and reject collisions", async (context) => {
  const fixture = await createFixture(componentEntrySource());
  context.after(() => removeFixture(fixture));
  const current = (await compileCatalogue(await loadConfig(fixture.root)))
    .manifest;
  const historical = {
    ...componentReviewManifest(current),
    schemaVersion: 5 as const,
  };

  assert.equal(legacyComponentVariantId("action", "default"), "action-default");
  assert.equal(
    legacyComponentVariantId("action", "action-default"),
    "action-default",
  );
  const localId = structuredClone(historical);
  const localAction = historicalComponent(localId.entries, "action");
  localAction.variants[0]!.id = "default";
  delete localAction.variants[0]!.description;
  const flattened = flattenComponentVariantEntries(
    parseHistoricalManifest(localId).entries,
  );
  const actionVariants = flattened.filter(
    (entry) =>
      entry.kind === "component" &&
      "variantOf" in entry &&
      entry.variantOf === "action",
  );
  assert.deepEqual(
    actionVariants.map(({ id }) => id),
    ["action-default", "action-disabled"],
  );
  assert.equal(actionVariants[0]!.description, localAction.description);

  const expandedCollision = structuredClone(historical);
  const collidingAction = historicalComponent(
    expandedCollision.entries,
    "action",
  );
  collidingAction.variants[0]!.id = "default";
  collidingAction.variants[1]!.id = "action-default";
  assertHistoricalVariantCollision(
    expandedCollision,
    "historical component variant action / action-default expands to action-default, which conflicts with historical component variant action / default",
  );

  const entryCollision = structuredClone(historical);
  const entryAction = historicalComponent(entryCollision.entries, "action");
  (entryCollision.entries as unknown as Record<string, unknown>[]).push({
    declaredDependencies: [],
    dependencies: [entryAction.sourcePath],
    description: "Conflicting historical entry",
    id: "action-default",
    kind: "page",
    navPath: [],
    relatedDocs: [],
    route: "pages/action-default.html",
    sourcePath: entryAction.sourcePath,
    title: "Conflicting entry",
  });
  assertHistoricalVariantCollision(
    entryCollision,
    "historical component variant action / action-default expands to action-default, which conflicts with manifest entry action-default",
  );
});

interface MutableHistoricalComponent {
  description: string;
  id: string;
  sourcePath: string;
  variants: { description?: string; id: string }[];
}

function historicalComponent(
  entries: readonly unknown[],
  id: string,
): MutableHistoricalComponent {
  const entry = entries.find(
    (candidate): candidate is MutableHistoricalComponent =>
      typeof candidate === "object" &&
      candidate !== null &&
      "id" in candidate &&
      candidate.id === id &&
      "variants" in candidate &&
      Array.isArray(candidate.variants),
  );
  assert.ok(entry);
  return entry;
}

function assertHistoricalVariantCollision(
  manifest: unknown,
  detail: string,
): void {
  assert.throws(
    () => parseHistoricalManifest(manifest),
    (error: Error) => {
      assert.equal(Reflect.get(error, "code"), "manifest-invalid");
      assert.equal(error.message, `[mokly/manifest-invalid] ${detail}`);
      return true;
    },
  );
}
