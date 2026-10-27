import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { detailKey } from "../src/catalogue/detail_fences.js";
import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";
import { viewerCatalogue } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

import {
  detailPairs,
  type DetailFixtures,
  heldDetails,
  rawDetailFixtures,
  rawIndexFixture,
  shellModelFixture,
} from "./catalogue_v8_fixture.js";
import { componentWorkspaceFixture } from "./component_workspace_fixture.js";

const { catalogue, model, source, sourceVariant } = componentWorkspaceFixture();

const EXCLUDED = {
  path: "mockups/action.css",
  reason: "no-matching-rule",
} as const;

test("a current variant reads Used by and Affected from its parent detail", () => {
  const parent = catalogue.byPath.get("components/action");
  const variant = catalogue.byPath.get("components/action/default");
  assert.ok(parent?.kind === "component");
  assert.ok(variant?.kind === "component");
  const parentData = publicWorkspace(catalogue, model, parent);
  const variantData = publicWorkspace(catalogue, model, variant);
  assert.deepEqual(variantData.usedBy, parentData.usedBy);
  assert.deepEqual(variantData.affected, parentData.affected);
  assert.notEqual(variantData.usageComplete, false);
});

test("a current variant does not show a zero list without its parent detail", () => {
  const partial = shellModelFixture(
    undefined,
    heldDetails(["components/action/default"]),
  );
  const partialCatalogue = viewerCatalogue(partial);
  const variant = partialCatalogue.byPath.get("components/action/default");
  assert.ok(variant?.kind === "component");
  const data = publicWorkspace(partialCatalogue, partial, variant);
  assert.deepEqual(data.usedBy, []);
  assert.deepEqual(data.affected, []);
  assert.equal(data.usageComplete, false);
});

test("a removed entry reads its own workspace detail", () => {
  const removed = catalogue.byPath.get("product/browse/home/retired");
  assert.ok(removed?.kind === "screen");
  const data = publicWorkspace(catalogue, model, removed);
  const record = model.removedEntries.find(
    (candidate) => candidate.entry.path === removed.path,
  );
  assert.ok(record?.snapshotId);
  const expected = model.details.get(
    detailKey({
      path: removed.path,
      snapshotId: record.snapshotId,
    }),
  )?.workspace;
  assert.ok(expected);
  assert.deepEqual(data.usedBy, expected.usedBy);
  assert.deepEqual(data.affected, expected.affected);
});

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
  assert.ok(historical.generation);
  const removedDetail = structuredClone(rawDetails.current[variant.path]!);
  delete removedDetail.deploymentId;
  delete removedDetail.revision;
  delete removedDetail.before;
  removedDetail.entry = {
    kind: "component",
    path: "components/action/retired",
    snapshotId,
  };
  removedDetail.generation = historical.generation;
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
  const historicalCatalogue = viewerCatalogue(model);
  const entry = historicalCatalogue.byPath.get("components/action/retired");
  assert.ok(entry?.kind === "component");
  const data = publicWorkspace(historicalCatalogue, model, entry);
  assert.deepEqual(
    data.usedBy.map((link) => link.title),
    ["Historical consumer"],
  );
});

/** The workspace inputs of the index and every detail after one edit. */
function edited(edit: (fixtures: DetailFixtures) => void) {
  const fixtures = rawDetailFixtures();
  edit(fixtures);
  const shell = shellModelFixture(
    undefined,
    new Map(
      detailPairs(undefined, fixtures).map(([request, detail]) => [
        detailKey(request),
        detail,
      ]),
    ),
  );
  return { catalogue: viewerCatalogue(shell), model: shell };
}

test("a published screen keeps its catalogue view evidence in Current", () => {
  const entry = catalogue.byPath.get("product/browse/details");
  assert.ok(entry?.kind === "screen");
  const data = publicWorkspace(catalogue, model, entry);
  // The desktop view's evidence is ready and records no stylesheet.
  assert.deepEqual(data.resourceEvidence, [
    { viewport: "mobile", colorScheme: "light", excludedResources: [EXCLUDED] },
    { viewport: "desktop", colorScheme: "light" },
  ]);
  const markup = renderToStaticMarkup(<WorkspaceEvidence data={data} />);
  assert.match(
    markup,
    /<p>This stylesheet changed, but none of the changed styles apply to this screen\.<\/p><p>Examined and excluded:<\/p><ul><li>mockups\/action\.css<\/li><\/ul>/,
  );
  assert.match(markup, /<p>No changes to this screen\.<\/p><\/section>$/);
});

test("a published component keeps its selected saved view's evidence", () => {
  // The parent shows its own views first, so its detail carries their evidence.
  const shown = edited(({ current }) => {
    const variant = current[sourceVariant.path]!;
    for (const view of current[source.path]!.views)
      view.resourceEvidence = structuredClone(
        variant.views.find(
          ({ viewport, colorScheme }) =>
            viewport === view.viewport && colorScheme === view.colorScheme,
        )!.resourceEvidence!,
      );
  });
  for (const path of [source.path, sourceVariant.path]) {
    const entry = shown.catalogue.byPath.get(path);
    assert.ok(entry?.kind === "component");
    const data = publicWorkspace(shown.catalogue, shown.model, entry);
    assert.deepEqual(
      data.resourceEvidence,
      (["mobile", "desktop"] as const).map((viewport) => ({
        viewport,
        colorScheme: "light",
        excludedResources: [EXCLUDED],
      })),
    );
    const markup = renderToStaticMarkup(
      <WorkspaceEvidence data={data} variantPath={path} />,
    );
    assert.match(
      markup,
      /<p>This stylesheet changed, but none of the changed styles apply to this variant\.<\/p>/,
    );
    assert.match(markup, /<p>No changes to this variant\.<\/p><\/section>$/);
  }
});

test("a published screen without view evidence projects none", () => {
  const path = "product/browse/home/empty";
  const unrecorded = edited(({ current }) => {
    for (const view of current[path]!.views) {
      delete view.resourceEvidence;
      delete view.state;
      delete view.ignoredIds;
    }
  });
  const entry = unrecorded.catalogue.byPath.get(path);
  assert.ok(entry?.kind === "screen");
  assert.equal(
    publicWorkspace(unrecorded.catalogue, unrecorded.model, entry)
      .resourceEvidence,
    undefined,
  );
});

test("a ready detail gives the routed entry its compared views and base side", () => {
  const moved = edited(({ current }) => {
    const detail = current["product/browse/home"]!;
    detail.before = { ...detail.before!, path: "product/home" };
    detail.views[0]!.ignoredIds = ["hero"];
  });
  const home = moved.catalogue.byPath.get("product/browse/home");
  assert.ok(home?.kind === "screen");
  const compared = publicWorkspace(moved.catalogue, moved.model, home).compared;
  assert.equal(compared?.path, "product/browse/home");
  assert.equal(compared?.basePath, "product/home");
  assert.deepEqual(compared?.views[0]?.ignoredIds, ["hero"]);
  assert.equal(compared?.views[0]?.state, "changed");
  assert.equal(compared?.savedProps, undefined);
  const variant = edited(({ current }) => {
    current["components/action/default"]!.before!.props = {
      label: ["string", "Earlier"],
    };
  });
  const entry = variant.catalogue.byPath.get("components/action/default");
  assert.ok(entry?.kind === "component");
  assert.deepEqual(
    publicWorkspace(variant.catalogue, variant.model, entry).compared
      ?.savedProps,
    {
      before: { label: ["string", "Earlier"] },
      after: { label: ["string", "Continue"] },
    },
  );
  const unready = edited(({ current }) => {
    for (const view of current["product/browse/home"]!.views) {
      delete view.resourceEvidence;
      delete view.state;
      delete view.ignoredIds;
    }
  });
  const pending = unready.catalogue.byPath.get("product/browse/home");
  assert.ok(pending?.kind === "screen");
  assert.equal(
    publicWorkspace(unready.catalogue, unready.model, pending).compared,
    undefined,
  );
});
