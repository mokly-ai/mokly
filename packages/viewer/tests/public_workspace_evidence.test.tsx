import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { detailKey } from "../src/catalogue/detail_fences.js";
import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";
import { viewerCatalogue } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

import {
  detailPairs,
  type DetailFixtures,
  heldDetails,
  rawDetailFixtures,
  shellModelFixture,
} from "./catalogue_v8_fixture.js";
import { componentWorkspaceFixture } from "./component_workspace_fixture.js";

const { catalogue, model, source, sourceVariant } = componentWorkspaceFixture();

const EXCLUDED = {
  path: "mockups/action.css",
  reason: "no-matching-rule",
} as const;

test("a current variant reads Used by and Affected from its parent detail", () => {
  const editedModel = edited(({ current }) => {
    const parent = current["components/action"]!;
    parent.workspace!.usedBy = [
      {
        entryPath: "product/browse/home",
        entryKind: "screen",
        title: "Edited consumer",
        viewport: "mobile",
        colorScheme: "light",
        instanceKey: "e".repeat(64),
        direct: true,
        removed: false,
        comparisonEligible: true,
      },
    ];
    parent.workspace!.affected = [
      {
        entryPath: "product/browse/details",
        entryKind: "screen",
        title: "Edited affected",
        viewport: "desktop",
        colorScheme: "light",
        instanceKey: "f".repeat(64),
        direct: true,
        removed: false,
        comparisonEligible: true,
      },
    ];
  });
  const parent = editedModel.catalogue.byPath.get("components/action");
  const variant = editedModel.catalogue.byPath.get("components/action/default");
  assert.ok(parent?.kind === "component");
  assert.ok(variant?.kind === "component");
  const parentData = publicWorkspace(
    editedModel.catalogue,
    editedModel.model,
    parent,
  );
  const variantData = publicWorkspace(
    editedModel.catalogue,
    editedModel.model,
    variant,
  );
  assert.deepEqual(
    variantData.usedBy.map(({ entryId }) => entryId),
    parentData.usedBy.map(({ entryId }) => entryId),
  );
  assert.deepEqual(
    variantData.affected.map(({ entryId }) => entryId),
    parentData.affected.map(({ entryId }) => entryId),
  );
  assert.equal(variantData.usedBy[0]?.title, "Edited consumer");
  assert.equal(variantData.affected[0]?.title, "Edited affected");
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
  const editedModel = edited(({ removed }) => {
    const detail = Object.values(removed).find(
      ({ entry }) => entry.path === "product/browse/home/retired",
    )!;
    detail.workspace!.usedBy = [
      {
        entryPath: "product/browse/home",
        entryKind: "screen",
        title: "Edited removed consumer",
        viewport: "mobile",
        colorScheme: "light",
        instanceKey: "e".repeat(64),
        direct: true,
        removed: false,
        comparisonEligible: true,
      },
    ];
    detail.workspace!.affected = [
      {
        entryPath: "product/browse/details",
        entryKind: "screen",
        title: "Edited removed affected",
        viewport: "desktop",
        colorScheme: "light",
        instanceKey: "f".repeat(64),
        direct: true,
        removed: false,
        comparisonEligible: true,
      },
    ];
  });
  const removed = editedModel.catalogue.byPath.get(
    "product/browse/home/retired",
  );
  assert.ok(removed?.kind === "screen");
  const data = publicWorkspace(
    editedModel.catalogue,
    editedModel.model,
    removed,
  );
  const record = editedModel.model.removedEntries.find(
    (candidate) => candidate.entry.path === removed.path,
  );
  assert.ok(record?.snapshotId);
  const expected = editedModel.model.details.get(
    detailKey({
      path: removed.path,
      snapshotId: record.snapshotId,
    }),
  )?.workspace;
  assert.ok(expected);
  assert.deepEqual(
    data.usedBy.map(({ entryId }) => entryId),
    expected.usedBy!.map(({ entryPath }) => entryPath),
  );
  assert.deepEqual(
    data.affected.map(({ entryId }) => entryId),
    expected.affected!.map(({ entryPath }) => entryPath),
  );
  assert.equal(data.usedBy[0]?.title, "Edited removed consumer");
  assert.equal(data.affected[0]?.title, "Edited removed affected");
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
