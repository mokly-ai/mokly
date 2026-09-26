import fs from "node:fs";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { CatalogueReadModel } from "../src/catalogue/types.js";
import type { ViewerEvidenceRevision } from "../src/client/host_capabilities.js";
import type { ViewerCapabilitySource } from "../src/client/host_capability_descriptor.js";
import { catalogueRouteEntry } from "../src/shell/catalogue.js";
import type { routeFromUrl } from "../src/shell/routes.js";
import { viewerCatalogue } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

const fixtureModel = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
export const model: CatalogueReadModel = {
  ...fixtureModel,
  comparisonUrl: null,
  removedEntries: [],
};

export function evidenceRevision(
  value: CatalogueReadModel,
  changedRoutes: readonly string[],
): CatalogueReadModel {
  const changed = new Set(changedRoutes);
  return {
    ...value,
    revision: { ...value.revision, evidence: value.revision.evidence + 1 },
    screens: value.screens.map((entry) => ({
      ...entry,
      changes: {
        status: "ready" as const,
        kind: changed.has(entry.route) ? "changed" : "unmodified",
        included: changed.has(entry.route),
      },
    })),
  };
}

export function capabilitySource(
  value: CatalogueReadModel,
  updateVersion: number,
): ViewerCapabilitySource {
  return {
    base: "origin/main",
    catalogueId: value.identity.id,
    contentRevision: value.revision.content,
    evidenceRevision: value.revision.evidence,
    updateVersion,
  };
}

export function viewerRevision(
  value: CatalogueReadModel,
  current: ViewerCapabilitySource,
  route: ReturnType<typeof routeFromUrl>,
): ViewerEvidenceRevision {
  const next = viewerCatalogue(value);
  const routeValue =
    route.view.kind === "target" ? route.view.target.entry.route : undefined;
  const entry = routeValue ? catalogueRouteEntry(next, routeValue) : undefined;
  const workspace =
    entry && (entry.kind === "screen" || entry.kind === "component")
      ? {
          ...publicWorkspace(value, entry),
          base: current.base,
        }
      : undefined;
  return {
    catalogue: value,
    source: {
      ...current,
      evidenceRevision: value.revision.evidence,
      updateVersion: current.updateVersion + 1,
    },
    ...(workspace ? { workspace } : {}),
  };
}
