import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { shellCatalogueModel } from "../src/catalogue/shell_model.js";
import type {
  CatalogueDetails,
  CatalogueReadModel,
} from "../src/catalogue/types.js";
import { ShellMain } from "../src/shell/views.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

function renderedBaselineHash(details: CatalogueDetails): string {
  const entry = {
    changes: {
      included: true,
      kind: "removed" as const,
      status: "ready" as const,
    },
    details,
    documentKey: "1".repeat(64),
    detailId: "2".repeat(64),
    path: "removed-page",
    kind: "page" as const,
    tags: [],
    title: "Removed page",
  };
  const model: CatalogueReadModel = {
    documents: [],
    baseCommit: "a".repeat(40),
    changesStatus: "ready",
    comparisonUrl: null,
    components: [],
    deploymentId: "0".repeat(64),
    identity: { id: "fixture", title: "Fixture" },
    pages: [],
    removedEntries: [{ folderTitles: [], entry }],
    revision: 1,
    schemaVersion: 8,
    screens: [],
    tree: [],
    useCases: [],
  };
  const catalogue = viewerCatalogue(shellCatalogueModel(model, new Map()));
  const removed = catalogue.removedEntries[0]?.entry;
  assert.ok(removed);
  const html = renderToStaticMarkup(
    <ShellMain
      catalogue={catalogue}
      context={{ base: "origin/main" }}
      view={{ kind: "target", target: { entry: removed, kind: "entry" } }}
    />,
  );
  const hash = /data-mokly-baseline="([a-f0-9]{64})"/.exec(html)?.[1];
  assert.ok(hash);
  return hash;
}

test("historical baseline hashes ignore logical object key order", () => {
  const first: CatalogueDetails = {
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
  };
  assert.equal(renderedBaselineHash(first), renderedBaselineHash(reordered));
});
