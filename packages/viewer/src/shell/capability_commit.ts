/** Atomic shell-store projection for one validated live evidence revision. */

import type { ViewerEvidenceRevision } from "../client/host_capabilities.js";
import {
  viewerCapabilityRequest,
  type ViewerCapabilityRequest,
  type ViewerCapabilitySource,
} from "../client/host_capability_descriptor.js";

import {
  adoptedViewerCatalogue,
  shellStateWithViewerEvidence,
  viewerCapabilityRoute,
} from "./capability_adoption.js";
import type { Catalogue } from "./catalogue.js";
import type { ShellState } from "./store_state.js";
import type { WorkspaceData } from "./workspace_data.js";

export interface BoundViewerWorkspace {
  request: ViewerCapabilityRequest;
  value: WorkspaceData;
}

export interface ViewerCapabilitySnapshot {
  catalogue: Catalogue;
  routeEvidence?: ViewerCapabilityRequest;
  source?: ViewerCapabilitySource;
  workspace?: BoundViewerWorkspace;
}

export interface ViewerCapabilityCommit {
  snapshot: ViewerCapabilitySnapshot;
  state: ShellState;
}

/** Rebind public catalogue, private workspace and their source as one commit. */
export function commitViewerEvidence(
  current: ViewerCapabilitySnapshot,
  state: ShellState,
  revision: ViewerEvidenceRevision,
): ViewerCapabilityCommit | undefined {
  if (!current.source) return;
  const catalogue = adoptedViewerCatalogue(
    current.catalogue,
    current.source,
    state.route,
    revision,
  );
  if (!catalogue) return;
  const nextState = shellStateWithViewerEvidence(state, catalogue);
  if (!nextState) return;
  const request = viewerCapabilityRequest(
    revision.source,
    viewerCapabilityRoute(nextState.route),
  );
  return {
    snapshot: {
      catalogue,
      routeEvidence: request,
      source: revision.source,
      ...(revision.workspace
        ? { workspace: { request, value: revision.workspace } }
        : {}),
    },
    state: nextState,
  };
}
