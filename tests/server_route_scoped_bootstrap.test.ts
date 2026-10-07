import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import type { CatalogueReadModel } from "@mokly/viewer";
import type { ManifestV9 } from "@mokly/viewer/data";
import {
  readScopedShellBootstrap,
  resolveCatalogueUsageScope,
  serializeShellBootstrap,
  type CatalogueUsageScopeTarget,
} from "@mokly/viewer/runtime";
import { createCatalogue } from "@mokly/viewer/server";

import { projectCatalogue } from "../dist/catalogue/projection.js";
import { homePage, notFoundPage, viewPage } from "../dist/server/pages.js";

const LIMIT = 1_048_576;
type RoutedManifestEntry = ManifestV9["entries"][number];
const manifest = JSON.parse(
  fs.readFileSync("examples/basic/mokly-generated/mokly-manifest.json", "utf8"),
) as ManifestV9;
const sourceRemoved = manifest.entries.find(
  (entry) =>
    entry.kind === "screen" && entry.path === "example/screens/welcome",
);
if (!sourceRemoved || sourceRemoved.kind !== "screen")
  throw new Error("Missing real historical fixture source.");
const removed = {
  ...structuredClone(sourceRemoved),
  path: "historical-example-welcome",
  title: "Historical Welcome",
};
const privateCatalogue = createCatalogue(manifest, [
  { folderTitles: [], entry: removed },
]);
const model = projectCatalogue({
  catalogue: privateCatalogue,
  changesStatus: "ready",
  comparisonUrl: null,
  configPath: "examples/basic/mokly.config.ts",
  revision: { content: 1, evidence: 1 },
});
const context = {
  base: "origin/main",
  comparisons: false,
  contentVersion: model.revision.content,
  readModel: model,
  updateVersion: 1,
};

test("every real Serve entry emits a strict bootstrap below 1 MiB", () => {
  const pages = [
    ["home", homePage(privateCatalogue, context)],
    ["missing", notFoundPage("missing", privateCatalogue, context)],
    ...routedEntries().map(
      (entry) =>
        [entry.path, viewPage(entry, privateCatalogue, context)] as const,
    ),
  ] as const;
  for (const [entryId, html] of pages) {
    const bytes = bootstrapBytes(html);
    assert.ok(
      Buffer.byteLength(bytes) < LIMIT,
      `${entryId} bootstrap exceeds 1 MiB`,
    );
    const parsed = readScopedShellBootstrap(JSON.parse(bytes));
    assert.equal(serializeShellBootstrap(parsed), bytes, entryId);
  }
});

test("real entry bootstraps ignore another entry's usage", () => {
  const cases: readonly [string, RoutedManifestEntry | undefined][] = [
    ["home", undefined],
    ["example/screens/welcome", entry("example/screens/welcome")],
    ["example/components/action", entry("example/components/action")],
    ["example/tour", entry("example/tour")],
    ["example/getting-started", entry("example/getting-started")],
    [removed.path, removed],
  ];
  for (const [name, selected] of cases) {
    const target: CatalogueUsageScopeTarget = selected
      ? { kind: "target", entryPath: selected.path, entryKind: selected.kind }
      : { kind: "home" };
    const changed = withOtherUsageChanged(model, target);
    const originalHtml = selected
      ? viewPage(selected, privateCatalogue, context)
      : homePage(privateCatalogue, context);
    const changedContext = { ...context, readModel: changed };
    const changedHtml = selected
      ? viewPage(selected, privateCatalogue, changedContext)
      : homePage(privateCatalogue, changedContext);
    assert.equal(
      bootstrapBytes(changedHtml),
      bootstrapBytes(originalHtml),
      name,
    );
  }
});

function routedEntries(): RoutedManifestEntry[] {
  return [...manifest.entries, removed];
}

function entry(id: string): RoutedManifestEntry {
  const found = routedEntries().find((candidate) => candidate.path === id);
  if (!found) throw new Error(`Missing real entry ${id}.`);
  return found;
}

function withOtherUsageChanged(
  complete: CatalogueReadModel,
  target: CatalogueUsageScopeTarget,
): CatalogueReadModel {
  const scope = resolveCatalogueUsageScope(complete, target);
  const other = usageViews(complete).find(({ view }) => !scope.has(view));
  if (!other) throw new Error("Missing out-of-scope usage view.");
  const changed = structuredClone(complete);
  const replacement = usageViews(changed).find(
    ({ entryId, view }) =>
      entryId === other.entryId &&
      view.viewport === other.view.viewport &&
      view.colorScheme === other.view.colorScheme,
  );
  if (!replacement) throw new Error("Missing cloned usage view.");
  replacement.view.usage =
    replacement.view.usage.status === "pending"
      ? { status: "unavailable" }
      : { status: "pending" };
  return changed;
}

function usageViews(catalogue: CatalogueReadModel) {
  return [
    ...catalogue.screens.flatMap((screen) =>
      screen.views.map((view) => ({ entryId: screen.path, view })),
    ),
    ...catalogue.components.flatMap((component) =>
      "variantOf" in component
        ? component.views.map((view) => ({ entryId: component.path, view }))
        : [],
    ),
    ...catalogue.removedEntries.flatMap(({ entry }) =>
      entry.kind === "screen" ||
      (entry.kind === "component" && "variantOf" in entry)
        ? entry.views.map((view) => ({ entryId: entry.path, view }))
        : [],
    ),
  ];
}

function bootstrapBytes(html: string): string {
  const bytes = html.match(
    /data-mokly-shell-bootstrap="" type="application\/json">([^<]+)<\/script>/,
  )?.[1];
  assert.ok(bytes);
  return bytes;
}
