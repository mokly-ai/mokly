import assert from "node:assert/strict";
import fs from "node:fs";

import { readCatalogue } from "../src/catalogue/reader.js";
import type {
  CatalogueNode,
  CatalogueReadModel,
} from "../src/catalogue/types.js";
import type { ViewerEvidenceRevision } from "../src/client/host_capabilities.js";
import type { ViewerCapabilitySource } from "../src/client/host_capability_descriptor.js";
import { catalogueRouteEntry } from "../src/shell/catalogue.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import type { ShellState } from "../src/shell/store_state.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";
import { defaultSelection } from "../src/viewer/selection.js";

const fixture = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v4.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

/** Disclosure identity introduced only by the retained Removed variant. */
export const variantKey = "variants:product/browse/home";

function stripVariant(node: CatalogueNode): CatalogueNode {
  if (node.kind === "entry" && node.path === "product/browse/home")
    return { kind: "entry", path: node.path };
  if (node.kind === "folder")
    return { ...node, children: node.children.map(stripVariant) };
  return node;
}

/** Valid public fixture whose Home screen has no current variants. */
export function baseModel(): CatalogueReadModel {
  return readCatalogue({
    ...fixture,
    screens: fixture.screens.filter((entry) => entry.variantOf === undefined),
    removedEntries: [],
    tree: fixture.tree.map(stripVariant),
  });
}

/** Add Home's former variant only as a retained historical row. */
export function withRemovedVariant(
  model: CatalogueReadModel,
  evidence: number,
): CatalogueReadModel {
  const variant = fixture.screens.find(
    (entry) => entry.variantOf === "product/browse/home",
  );
  assert.ok(variant);
  return readCatalogue({
    ...model,
    revision: { ...model.revision, evidence },
    removedEntries: [
      {
        folderTitles: ["Product", "Browse"],
        parentTitle: fixture.screens.find(
          (entry) => entry.path === variant.variantOf,
        )!.title,
        entry: {
          ...variant,
          changes: { status: "ready", kind: "removed", included: true },
          views: variant.views.map((view) => ({
            ...view,
          })),
        },
        snapshotId: "f".repeat(64),
        preview: { kind: "screen" },
      },
    ],
  });
}

/** Current capability source before one monotonic evidence revision. */
export function source(model: CatalogueReadModel): ViewerCapabilitySource {
  return {
    base: "origin/main",
    catalogueId: model.identity.id,
    contentRevision: model.revision.content,
    evidenceRevision: model.revision.evidence,
    updateVersion: 1,
  };
}

/** Valid revision carrying the route-private workspace only when needed. */
export function revision(
  model: CatalogueReadModel,
  previous: ViewerCapabilitySource,
  entryId: string | null,
): ViewerEvidenceRevision {
  const catalogue = viewerCatalogue(model);
  const entry = entryId ? catalogueRouteEntry(catalogue, entryId) : undefined;
  const workspace =
    entry &&
    (entry.kind === "screen" ||
      (entry.kind === "component" && !("variantOf" in entry)))
      ? { ...publicWorkspace(catalogue, model, entry), base: previous.base }
      : undefined;
  return {
    catalogue: model,
    source: {
      ...previous,
      evidenceRevision: model.revision.evidence,
      updateVersion: previous.updateVersion + 1,
    },
    ...(workspace ? { workspace } : {}),
  };
}

/** Initialize an isolated shell at either Home or the catalogue root. */
export function initialState(
  model: CatalogueReadModel,
  route: string,
): ShellState {
  const catalogue = viewerCatalogue(model);
  const selected = route === "/" ? null : "product/browse/home";
  const view = routeFromUrl(catalogue, new URL(`https://example.test${route}`));
  return createInitialShellState(
    catalogue,
    viewerContext(model, { ...defaultSelection, screenPath: selected }),
    view.view,
    undefined,
  );
}
