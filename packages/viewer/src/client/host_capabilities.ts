/** Typed behavior boundary between the hydrated shell and first-party live hosts. */

import type { CurrentPath } from "../catalogue/path_types.js";
import { readCatalogue } from "../catalogue/reader.js";
import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import type {
  ComponentRenderRequest,
  ComponentRenderSuccess,
} from "../components/render_types.js";
import type { ShellRecoverySnapshot } from "../shell/store_state.js";
import type { ShellGeneratedView } from "../shell/usage_types.js";
import type { WorkspaceData } from "../shell/workspace_data.js";
import { readLiveShellBootstrap } from "../standalone/scoped_bootstrap.js";

import type {
  ViewerCapabilityRequest,
  ViewerCapabilitySource,
} from "./host_capability_descriptor.js";
import {
  viewerCapabilityRequestMatches,
  viewerCapabilitySourceEquals,
} from "./host_capability_descriptor.js";

/** Validated same-content catalogue revision delivered by a live host. */
export interface ViewerEvidenceRevision {
  catalogue: ShellCatalogueReadModel;
  source: ViewerCapabilitySource;
  workspace?: WorkspaceData;
}

/** Route-scoped private evidence from the page accepted during hydration. */
export interface ViewerEvidenceCapability {
  initialWorkspace(request: ViewerCapabilityRequest): WorkspaceData | undefined;
  loadRouteEvidence(
    request: ViewerCapabilityRequest,
    signal: AbortSignal,
  ): Promise<ViewerEvidenceRevision | undefined>;
}

/** Store transitions supplied when the shell subscribes to watched updates. */
export interface ViewerUpdateActions {
  adoptEvidence(revision: ViewerEvidenceRevision): boolean | Promise<boolean>;
  captureRecovery(): ShellRecoverySnapshot | undefined;
}

/** Watched update and one-shot recovery capability. */
export interface ViewerUpdateCapability {
  consumeRecovery(
    request: ViewerCapabilityRequest,
  ): ShellRecoverySnapshot | undefined;
  subscribe(
    request: ViewerCapabilityRequest,
    actions: ViewerUpdateActions,
    signal: AbortSignal,
  ): void;
}

/** Authenticated temporary component previews, with the token hidden in the host. */
export interface ViewerTemporaryPreviewCapability {
  expired(
    request: ViewerCapabilityRequest,
    frame: HTMLIFrameElement,
    previews: Iterable<ComponentRenderSuccess<CurrentPath>>,
    signal: AbortSignal,
  ): Promise<boolean>;
  render(
    request: ViewerCapabilityRequest,
    input: ComponentRenderRequest,
    view: ShellGeneratedView,
    signal: AbortSignal,
  ): Promise<ComponentRenderSuccess<CurrentPath>>;
}

/** On-demand Usage loading for the currently routed workspace. */
export interface ViewerOnDemandCapability {
  loadWorkspace(
    request: ViewerCapabilityRequest,
    data: WorkspaceData,
    signal: AbortSignal,
    changed: () => void,
  ): (views: readonly ShellGeneratedView[]) => void;
}

/** Optional private services exposed to one hydrated shell tree. */
export interface ViewerHostCapabilities {
  evidence: ViewerEvidenceCapability;
  onDemand?: ViewerOnDemandCapability;
  source: ViewerCapabilitySource;
  temporaryPreviews?: ViewerTemporaryPreviewCapability;
  updates: ViewerUpdateCapability;
}

/** Decode and fence one same-content evidence response. */
export function readViewerEvidenceRevision(
  installed: ViewerCapabilitySource,
  request: ViewerCapabilityRequest,
  nextSource: ViewerCapabilitySource,
  value: unknown,
  workspace?: WorkspaceData,
): ViewerEvidenceRevision | undefined {
  if (!evidenceSourceMatches(installed, request, nextSource, true)) return;
  return validateEvidenceRevision(
    installed,
    request,
    nextSource,
    readCatalogue(value),
    workspace,
    true,
  );
}

/** Decode one routed page whose public bootstrap and private evidence are paired. */
export function readViewerRouteEvidenceRevision(
  installed: ViewerCapabilitySource,
  request: ViewerCapabilityRequest,
  nextSource: ViewerCapabilitySource,
  value: unknown,
  workspace?: WorkspaceData,
): ViewerEvidenceRevision | undefined {
  const bootstrap = readLiveShellBootstrap(value);
  const entryPath =
    bootstrap.view.kind === "target" ? bootstrap.view.entryPath : null;
  if (
    entryPath !== request.entryPath ||
    bootstrap.context.base !== nextSource.base ||
    bootstrap.context.contentVersion !== nextSource.contentRevision ||
    bootstrap.context.updateVersion !== nextSource.updateVersion ||
    bootstrap.context.previewGeneration !== nextSource.previewGeneration
  )
    return;
  return validateEvidenceRevision(
    installed,
    request,
    nextSource,
    bootstrap.catalogue,
    workspace,
    false,
  );
}

function validateEvidenceRevision(
  installed: ViewerCapabilitySource,
  request: ViewerCapabilityRequest,
  nextSource: ViewerCapabilitySource,
  catalogue: ShellCatalogueReadModel,
  workspace: WorkspaceData | undefined,
  requireAdvance: boolean,
): ViewerEvidenceRevision | undefined {
  if (!evidenceSourceMatches(installed, request, nextSource, requireAdvance))
    return;
  if (
    catalogue.identity.id !== nextSource.catalogueId ||
    catalogue.revision.content !== nextSource.contentRevision ||
    catalogue.revision.evidence !== nextSource.evidenceRevision
  )
    return;
  const expected = workspaceEntry(catalogue, request.entryPath);
  if (
    (expected === undefined) !== (workspace === undefined) ||
    (expected &&
      workspace &&
      (workspace.entry.path !== expected.path ||
        workspace.entry.kind !== expected.kind))
  )
    return;
  return {
    catalogue,
    source: nextSource,
    ...(workspace ? { workspace } : {}),
  };
}

function evidenceSourceMatches(
  installed: ViewerCapabilitySource,
  request: ViewerCapabilityRequest,
  nextSource: ViewerCapabilitySource,
  requireAdvance: boolean,
): boolean {
  return (
    viewerCapabilityRequestMatches(installed, request) &&
    viewerCapabilityRequestMatches(request.source, {
      entryPath: request.entryPath,
      source: nextSource,
    }) &&
    (!requireAdvance || sourceAdvances(request.source, nextSource))
  );
}

function sourceAdvances(
  current: ViewerCapabilitySource,
  next: ViewerCapabilitySource,
): boolean {
  return (
    next.evidenceRevision > current.evidenceRevision ||
    next.updateVersion > current.updateVersion
  );
}

/** Abort all work owned by an obsolete route or source descriptor. */
export class ViewerCapabilityScope {
  private controller = new AbortController();

  constructor(private request: ViewerCapabilityRequest) {}

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /** Retain work only while every request field remains current. */
  replace(request: ViewerCapabilityRequest): AbortSignal {
    if (sameRequest(this.request, request)) return this.controller.signal;
    this.controller.abort();
    this.controller = new AbortController();
    this.request = request;
    return this.controller.signal;
  }

  /** Cancel the final request on unmount. */
  close(): void {
    this.controller.abort();
  }
}

function sameRequest(
  left: ViewerCapabilityRequest,
  right: ViewerCapabilityRequest,
): boolean {
  return (
    left.entryPath === right.entryPath &&
    viewerCapabilitySourceEquals(left.source, right.source)
  );
}

function workspaceEntry(
  catalogue: ShellCatalogueReadModel,
  entryPath: string | null,
) {
  if (entryPath === null) return;
  return [
    ...catalogue.screens,
    ...catalogue.components,
    ...catalogue.removedEntries.map(({ entry }) => entry),
  ].find(
    (entry) =>
      (entry.kind === "screen" || entry.kind === "component") &&
      entry.path === entryPath,
  );
}
