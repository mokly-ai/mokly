import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type {
  CatalogueDetails,
  CatalogueReadModel,
} from "../src/catalogue/types.js";
import { ShellMain } from "../src/shell/views.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

function renderedBaselineHash(details: CatalogueDetails): string {
  const entry = {
    changes: {
      eligible: true,
      included: true,
      kind: "removed" as const,
      status: "ready" as const,
    },
    details,
    documentPath: null,
    id: "removed-page",
    kind: "page" as const,
    route: "removed.html",
    tags: [],
    title: "Removed page",
  };
  const model: CatalogueReadModel = {
    changesStatus: "ready",
    collections: [],
    comparisonUrl: null,
    components: [],
    deploymentId: "0".repeat(64),
    identity: { id: "fixture", title: "Fixture" },
    pages: [],
    removedEntries: [{ ancestors: [], entry }],
    revision: { content: 1, evidence: 1 },
    schemaVersion: 1,
    screens: [],
    tree: { components: [], pages: [] },
    useCases: [],
  };
  const catalogue = viewerCatalogue(model);
  const removed = catalogue.removedEntries[0]?.entry;
  assert.ok(removed);
  const html = renderToStaticMarkup(
    <ShellMain
      catalogue={catalogue}
      context={{ base: "origin/main", updateVersion: 1 }}
      view={{ kind: "target", target: { entry: removed, kind: "entry" } }}
    />,
  );
  const hash = /data-mokly-baseline="([a-f0-9]{64})"/.exec(html)?.[1];
  assert.ok(hash);
  return hash;
}

test("historical baseline hashes ignore logical object key order", () => {
  const first: CatalogueDetails = {
    dependencies: ["notes.md"],
    description: "Historical guidance",
    rationale: "Preserve context",
    relatedDocs: ["notes.md"],
    sourcePath: "entries/history.mockup.tsx",
  };
  const reordered: CatalogueDetails = {
    sourcePath: "entries/history.mockup.tsx",
    relatedDocs: ["notes.md"],
    rationale: "Preserve context",
    description: "Historical guidance",
    dependencies: ["notes.md"],
  };
  assert.equal(renderedBaselineHash(first), renderedBaselineHash(reordered));
});
