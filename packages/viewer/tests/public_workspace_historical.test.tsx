import assert from "node:assert/strict";
import { test } from "node:test";

import { detailKey } from "../src/catalogue/detail_fences.js";
import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { publicWorkspace } from "../src/shell/public_workspace.js";

import {
  detailPairs,
  rawDetailFixtures,
  rawIndexFixture,
  shellModelFixture,
} from "./catalogue_v9_fixture.js";

test("a removed component variant keeps its own workspace lists", () => {
  const snapshotId = "f".repeat(64);
  const rawIndex = rawIndexFixture();
  const rawDetails = rawDetailFixtures();
  const variant = rawIndex.components.find(
    (entry) => entry.path === "components/action/default",
  )!;
  const removedVariant = {
    ...structuredClone(variant),
    path: "components/action/retired",
    title: "Retired Action",
    changes: { status: "ready", kind: "removed", included: true } as const,
  };
  rawIndex.removedEntries = [
    ...rawIndex.removedEntries,
    {
      entry: removedVariant,
      folderTitles: ["Components"],
      parentTitle: "Action",
      snapshotId,
    },
  ];
  const historical = Object.values(rawDetails.removed)[0]!;
  assert.ok(historical.detailId);
  const removedDetail = structuredClone(rawDetails.current[variant.path]!);
  delete removedDetail.revision;
  delete removedDetail.before;
  removedDetail.entry = {
    kind: "component",
    path: "components/action/retired",
    snapshotId,
  };
  removedDetail.detailId = historical.detailId;
  removedDetail.workspace = {
    ...removedDetail.workspace!,
    usedBy: [
      {
        entryPath: "product/browse/home",
        entryKind: "screen",
        title: "Historical consumer",
        viewport: "mobile",
        colorScheme: "light",
        instanceKey: "b".repeat(64),
        direct: true,
        removed: false,
        comparisonEligible: false,
      },
    ],
    affected: [],
  };
  rawDetails.removed[snapshotId] = removedDetail;
  const index = readCatalogueIndex(rawIndex);
  const model = shellModelFixture(
    index,
    new Map(
      detailPairs(undefined, rawDetails).map(([request, detail]) => [
        detailKey(request),
        detail,
      ]),
    ),
  );
  const historicalCatalogue = createCatalogue(model);
  const entry = historicalCatalogue.byPath.get("components/action/retired");
  assert.ok(entry?.kind === "component");
  const data = publicWorkspace(historicalCatalogue, model, entry);
  assert.deepEqual(
    data.usedBy.map((link) => link.title),
    ["Historical consumer"],
  );
});
