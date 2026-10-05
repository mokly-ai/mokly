/** Pure validation and projection for live evidence accepted by the shell store. */

import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import type { ViewerEvidenceRevision } from "../client/host_capabilities.js";
import {
  viewerCapabilityRequestMatches,
  type ViewerCapabilitySource,
} from "../client/host_capability_descriptor.js";
import { canonicalJson } from "../components/data.js";
import { entryRoute } from "../navigation/routes.js";
import { viewerCatalogue, viewerContext } from "../viewer/projection.js";

import { catalogueRouteEntry, type Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { reconcileDisclosures } from "./disclosure_storage.js";
import {
  catalogueNavSections,
  defaultDisclosures,
  navigationFiltering,
} from "./nav_model.js";
import type { ShellRoute } from "./routes.js";
import type { ShellState } from "./store_state.js";
import { toRouteTarget } from "./target.js";

/** The logical entry whose private evidence belongs to the current shell route. */
export function viewerCapabilityEntryPath(route: ShellRoute): string | null {
  return route.view.kind === "target" ? route.view.target.entry.path : null;
}

/** Convert a validated public/private revision into the shell catalogue model. */
export function adoptedViewerCatalogue(
  current: Catalogue,
  currentSource: ViewerCapabilitySource,
  route: ShellRoute,
  revision: ViewerEvidenceRevision,
): Catalogue | undefined {
  if (
    !viewerCapabilityRequestMatches(currentSource, {
      entryPath: viewerCapabilityEntryPath(route),
      source: revision.source,
    })
  )
    return;
  if (
    revision.catalogue.identity.id !== revision.source.catalogueId ||
    revision.catalogue.revision.content !== revision.source.contentRevision ||
    revision.catalogue.revision.evidence !== revision.source.evidenceRevision
  )
    return;
  const next = viewerCatalogue(revision.catalogue);
  if (
    !sameCatalogueContent(current, next) ||
    !sameCurrentRoute(current, next, route)
  )
    return;
  const routed =
    route.view.kind === "target"
      ? catalogueRouteEntry(
          next,
          route.view.target.entry.path,
          route.view.target.entry.kind,
        )
      : undefined;
  const ownsWorkspace =
    routed?.kind === "screen" || routed?.kind === "component";
  if (ownsWorkspace !== (revision.workspace !== undefined)) return;
  if (
    revision.workspace &&
    (!routed ||
      revision.workspace.entry.path !== routed.path ||
      revision.workspace.entry.kind !== routed.kind ||
      revision.workspace.removed !==
        !next.manifest.entries.some((entry) => entry.path === routed.path))
  )
    return;
  return next;
}

/** Rebind evidence-owned route records without changing interaction state. */
export function shellStateWithViewerEvidence(
  state: ShellState,
  catalogue: Catalogue,
): ShellState | undefined {
  let route = state.route;
  if (route.view.kind === "target") {
    const previous = route.view.target.entry;
    const entry = route.snapshot
      ? catalogue.removedEntries.find(
          (record) =>
            record.entry.path === previous.path &&
            record.entry.kind === previous.kind &&
            record.snapshotId === route.snapshot,
        )?.entry
      : catalogue.byPath.get(previous.path);
    const target = entry && toRouteTarget(entry);
    route =
      target && entry.path === previous.path && entry.kind === previous.kind
        ? { ...route, view: { kind: "target", target } }
        : {
            ...route,
            view: {
              kind: "missing",
              requested: entryRoute(previous.path),
            },
          };
  }
  const sections = catalogueNavSections(catalogue);
  const activeId =
    route.view.kind === "target" ? route.view.target.entry.path : undefined;
  const defaults = defaultDisclosures(sections, activeId);
  const disclosures = reconcileDisclosures(
    defaults,
    state.disclosures,
    navigationFiltering(state.selection) ? "open" : "default",
  );
  const filterBaseline = state.filterBaseline
    ? reconcileDisclosures(defaults, state.filterBaseline, "default")
    : undefined;
  const next: ShellState = {
    ...state,
    route,
    disclosures,
    filterBaseline,
  };
  const status = catalogue.publicModel?.changesStatus;
  next.changesStatus = status && status !== "disabled" ? status : undefined;
  return next;
}

/** Project the accepted source and public evidence into the runtime context. */
export function shellContextWithViewerEvidence(
  context: ShellContext,
  catalogue: Catalogue,
  source: ViewerCapabilitySource,
  state: ShellState,
): ShellContext {
  const model = catalogue.publicModel;
  if (!model) return context;
  const stable = { ...context };
  delete stable.activeId;
  delete stable.changedEntries;
  delete stable.materialEntries;
  delete stable.changesStatus;
  delete stable.comparisons;
  delete stable.componentChanges;
  delete stable.contentVersion;
  delete stable.previewGeneration;
  delete stable.readModel;
  delete stable.renderCapability;
  delete stable.snapshotId;
  const projected = viewerContext(model, state.selection);
  return {
    ...stable,
    ...projected,
    base: source.base,
    embedded: context.embedded === true,
    ...(context.comparisons === undefined
      ? {}
      : { comparisons: context.comparisons }),
    contentVersion: source.contentRevision,
    updateVersion: source.updateVersion,
    ...(source.previewGeneration
      ? { previewGeneration: source.previewGeneration }
      : {}),
  };
}

function sameCatalogueContent(current: Catalogue, next: Catalogue): boolean {
  const left = current.publicModel;
  const right = next.publicModel;
  return (
    left !== undefined &&
    right !== undefined &&
    left.identity.id === right.identity.id &&
    left.revision.content === right.revision.content &&
    right.revision.evidence >= left.revision.evidence
  );
}

function sameCurrentRoute(
  current: Catalogue,
  next: Catalogue,
  route: ShellRoute,
): boolean {
  if (route.view.kind !== "target") return true;
  const previous = route.view.target.entry;
  const currentEntry = current.manifest.entries.find(
    (entry) => entry.path === previous.path,
  );
  const nextEntry = next.manifest.entries.find(
    (entry) => entry.path === previous.path,
  );
  if (!currentEntry) {
    if (route.snapshot !== undefined) return true;
    const currentHistory = removedEntry(current.publicModel, previous.path);
    const nextHistory = removedEntry(next.publicModel, previous.path);
    return (
      currentHistory !== undefined &&
      nextHistory !== undefined &&
      canonicalJson(currentHistory) === canonicalJson(nextHistory)
    );
  }
  if (
    !nextEntry ||
    currentEntry.path !== previous.path ||
    currentEntry.kind !== previous.kind ||
    nextEntry.path !== previous.path ||
    nextEntry.kind !== previous.kind
  )
    return false;
  return true;
}

function removedEntry(
  catalogue: ShellCatalogueReadModel | undefined,
  id: string,
) {
  return catalogue?.removedEntries.find((item) => item.entry.path === id);
}
