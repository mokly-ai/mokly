/** Pure validation and projection for live evidence accepted by the shell store. */

import type { CatalogueReadModel } from "../catalogue/types.js";
import type { ViewerEvidenceRevision } from "../client/host_capabilities.js";
import {
  viewerCapabilityRequestMatches,
  type ViewerCapabilitySource,
} from "../client/host_capability_descriptor.js";
import { canonicalJson } from "../components/data.js";
import { viewerCatalogue, viewerContext } from "../viewer/projection.js";

import { catalogueRouteEntry, type Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { ShellRoute } from "./routes.js";
import type { ShellState } from "./store_state.js";
import { toRouteTarget } from "./target.js";

/** The logical entry whose private evidence belongs to the current shell route. */
export function viewerCapabilityRoute(route: ShellRoute): string | null {
  return route.view.kind === "target" ? route.view.target.entry.route : null;
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
      route: viewerCapabilityRoute(route),
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
      ? catalogueRouteEntry(next, route.view.target.entry.route)
      : undefined;
  const ownsWorkspace =
    routed?.kind === "screen" || routed?.kind === "component";
  if (ownsWorkspace !== (revision.workspace !== undefined)) return;
  if (
    revision.workspace &&
    (!routed ||
      revision.workspace.entry.id !== routed.id ||
      revision.workspace.entry.kind !== routed.kind ||
      revision.workspace.entry.route !== routed.route ||
      revision.workspace.removed !== !next.byRoute.has(routed.route))
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
    const entry = catalogueRouteEntry(catalogue, previous.route);
    const target = entry && toRouteTarget(entry);
    if (!target || entry.id !== previous.id || entry.kind !== previous.kind)
      return;
    route = { ...route, view: { kind: "target", target } };
  }
  const next = { ...state, route };
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
  delete stable.activeRoute;
  delete stable.changedRoutes;
  delete stable.changesStatus;
  delete stable.comparisons;
  delete stable.componentChanges;
  delete stable.contentVersion;
  delete stable.previewGeneration;
  delete stable.readModel;
  delete stable.renderCapability;
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
  const currentEntry = catalogueRouteEntry(current, previous.route);
  const nextEntry = catalogueRouteEntry(next, previous.route);
  if (
    !currentEntry ||
    !nextEntry ||
    currentEntry.id !== previous.id ||
    currentEntry.kind !== previous.kind ||
    nextEntry.id !== previous.id ||
    nextEntry.kind !== previous.kind
  )
    return false;
  const currentHistory = removedEntry(current.publicModel, previous.route);
  const nextHistory = removedEntry(next.publicModel, previous.route);
  if (!currentHistory) return !nextHistory;
  return (
    nextHistory !== undefined &&
    canonicalJson(currentHistory) === canonicalJson(nextHistory)
  );
}

function removedEntry(
  catalogue: CatalogueReadModel | undefined,
  route: string,
) {
  return catalogue?.removedEntries.find((item) => item.entry.route === route);
}
