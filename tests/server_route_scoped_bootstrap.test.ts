import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import type { CatalogueReadModel } from "@mokly/viewer";
import type { ManifestV5 } from "@mokly/viewer/data";
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
type RoutedManifestEntry = Exclude<
  ManifestV5["entries"][number],
  { kind: "collection" }
>;
const manifest = JSON.parse(
  fs.readFileSync("examples/basic/generated/mokly-manifest.json", "utf8"),
) as ManifestV5;
const sourceRemoved = manifest.entries.find(
  (entry) => entry.kind === "screen" && entry.route === "screens/welcome.html",
);
if (!sourceRemoved || sourceRemoved.kind !== "screen")
  throw new Error("Missing real historical fixture source.");
const removed = {
  ...structuredClone(sourceRemoved),
  id: "historical-example-welcome",
  route: "screens/historical-welcome.html",
  title: "Historical Welcome",
};
const privateCatalogue = createCatalogue(manifest, [
  { ancestors: [], entry: removed },
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

test("every real Serve route emits a strict bootstrap below 1 MiB", () => {
  const pages = [
    ["home", homePage(privateCatalogue, context)],
    ["missing", notFoundPage("missing", privateCatalogue, context)],
    ...routedEntries().map(
      (entry) =>
        [entry.route, viewPage(entry, privateCatalogue, context)] as const,
    ),
  ] as const;
  for (const [route, html] of pages) {
    const bytes = bootstrapBytes(html);
    assert.ok(
      Buffer.byteLength(bytes) < LIMIT,
      `${route} bootstrap exceeds 1 MiB`,
    );
    const parsed = readScopedShellBootstrap(JSON.parse(bytes));
    assert.equal(serializeShellBootstrap(parsed), bytes, route);
  }
});

test("real route bootstraps ignore another entry's usage", () => {
  const cases: readonly [string, RoutedManifestEntry | undefined][] = [
    ["home", undefined],
    ["screens/welcome.html", entry("screens/welcome.html")],
    ["components/action.html", entry("components/action.html")],
    ["user-flows/example-tour.html", entry("user-flows/example-tour.html")],
    ["handbook.html", entry("handbook.html")],
    [removed.route, removed],
  ];
  for (const [name, selected] of cases) {
    const target: CatalogueUsageScopeTarget = selected
      ? { kind: "target", route: selected.route }
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
  return [
    ...manifest.entries.filter(
      (entry): entry is RoutedManifestEntry => entry.kind !== "collection",
    ),
    removed,
  ];
}

function entry(route: string): RoutedManifestEntry {
  const found = routedEntries().find((candidate) => candidate.route === route);
  if (!found) throw new Error(`Missing real route ${route}.`);
  return found;
}

function withOtherUsageChanged(
  complete: CatalogueReadModel,
  target: CatalogueUsageScopeTarget,
): CatalogueReadModel {
  const scope = resolveCatalogueUsageScope(complete, target);
  const other = usageViews(complete).find(
    (view) => !scope.has(view) && view.fragmentPath !== null,
  );
  if (!other?.fragmentPath) throw new Error("Missing out-of-scope usage view.");
  const changed = structuredClone(complete);
  const replacement = usageViews(changed).find(
    (view) => view.fragmentPath === other.fragmentPath,
  );
  if (!replacement) throw new Error("Missing cloned usage view.");
  replacement.usage =
    replacement.usage.status === "pending"
      ? { status: "unavailable" }
      : { status: "pending" };
  return changed;
}

function usageViews(catalogue: CatalogueReadModel) {
  return [
    ...catalogue.screens.flatMap((screen) => screen.views),
    ...catalogue.components.flatMap((component) =>
      component.variants.flatMap((variant) => variant.views),
    ),
    ...catalogue.removedEntries.flatMap(({ entry }) =>
      entry.kind === "screen"
        ? entry.views
        : entry.kind === "component"
          ? entry.variants.flatMap((variant) => variant.views)
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
