/** Typed behavior boundary between the hydrated shell and first-party live hosts. */

import { readCatalogue } from "../catalogue/reader.js";
import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import type {
  ComponentRenderRequest,
  ComponentRenderSuccess,
} from "../components/render_types.js";
import type { GeneratedComponentView } from "../components/views.js";
import type { ShellRecoverySnapshot } from "../shell/store_state.js";
import type { WorkspaceData } from "../shell/workspace_data.js";
import { readLiveShellBootstrap } from "../standalone/scoped_bootstrap.js";

import {
  viewerCapabilityRequestMatches,
  viewerCapabilitySourceEquals,
} from "./host_capability_descriptor.js";
import type {
  ViewerCapabilityRequest,
  ViewerCapabilitySource,
} from "./host_capability_descriptor.js";
import type {
  InteractivePrepareResponse,
  ViewerInteractiveDescriptor,
} from "./interactive_capability.js";
import type { RebuildStatus } from "./rebuild_status.js";

/** Validated same-content catalogue revision delivered by a live host. */
export interface ViewerEvidenceRevision {
  catalogue: ShellCatalogueReadModel;
  interactive?: ViewerInteractiveDescriptor;
  rebuildStatus?: RebuildStatus;
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
  adoptInteractive?(interactive: ViewerInteractiveDescriptor): void;
  adoptRebuildStatus?(status: RebuildStatus): void;
  adoptEvidence(revision: ViewerEvidenceRevision): boolean | Promise<boolean>;
  captureRecovery(): ShellRecoverySnapshot | undefined;
}

/** Same-origin preparation transport for the current Live generation. */
export interface ViewerInteractiveCapability {
  prepare(
    request: ViewerCapabilityRequest,
    generation: string,
    signal: AbortSignal,
  ): Promise<InteractivePrepareResponse>;
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
    previews: Iterable<ComponentRenderSuccess>,
    signal: AbortSignal,
  ): Promise<boolean>;
  render(
    request: ViewerCapabilityRequest,
    input: ComponentRenderRequest,
    view: GeneratedComponentView,
    signal: AbortSignal,
  ): Promise<ComponentRenderSuccess>;
}

/** On-demand Usage loading for the currently routed workspace. */
export interface ViewerOnDemandCapability {
  loadWorkspace(
    request: ViewerCapabilityRequest,
    data: WorkspaceData,
    signal: AbortSignal,
    changed: () => void,
  ): (views: readonly GeneratedComponentView[]) => void;
}

/** Optional private services exposed to one hydrated shell tree. */
export interface ViewerHostCapabilities {
  evidence: ViewerEvidenceCapability;
  interactive?: ViewerInteractiveCapability;
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
  interactive?: ViewerInteractiveDescriptor,
  rebuildStatus?: RebuildStatus,
): ViewerEvidenceRevision | undefined {
  if (!evidenceSourceMatches(installed, request, nextSource, true)) return;
  return validateEvidenceRevision(
    installed,
    request,
    nextSource,
    readCatalogue(value),
    workspace,
    interactive,
    rebuildStatus,
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
  interactive?: ViewerInteractiveDescriptor,
  rebuildStatus?: RebuildStatus,
): ViewerEvidenceRevision | undefined {
  const bootstrap = readLiveShellBootstrap(value);
  const entryId =
    bootstrap.view.kind === "target" ? bootstrap.view.entryId : null;
  if (
    entryId !== request.entryId ||
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
    interactive,
    rebuildStatus,
    false,
  );
}

function validateEvidenceRevision(
  installed: ViewerCapabilitySource,
  request: ViewerCapabilityRequest,
  nextSource: ViewerCapabilitySource,
  catalogue: ShellCatalogueReadModel,
  workspace: WorkspaceData | undefined,
  interactive: ViewerInteractiveDescriptor | undefined,
  rebuildStatus: RebuildStatus | undefined,
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
  const expected = workspaceEntry(catalogue, request.entryId);
  if (
    (expected === undefined) !== (workspace === undefined) ||
    (expected &&
      workspace &&
      (workspace.entry.id !== expected.id ||
        workspace.entry.kind !== expected.kind))
  )
    return;
  return {
    catalogue,
    source: nextSource,
    ...(interactive ? { interactive } : {}),
    ...(rebuildStatus ? { rebuildStatus } : {}),
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
      entryId: request.entryId,
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
    left.entryId === right.entryId &&
    viewerCapabilitySourceEquals(left.source, right.source)
  );
}

function workspaceEntry(
  catalogue: ShellCatalogueReadModel,
  entryId: string | null,
) {
  if (entryId === null) return;
  return [
    ...catalogue.screens,
    ...catalogue.components,
    ...catalogue.removedEntries.map(({ entry }) => entry),
  ].find(
    (entry) =>
      (entry.kind === "screen" || entry.kind === "component") &&
      entry.id === entryId,
  );
}
