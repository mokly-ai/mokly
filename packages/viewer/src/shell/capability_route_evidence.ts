/** Private route evidence loaded after same-shell navigation to a workspace. */

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type { ViewerHostCapabilities } from "../client/host_capabilities.js";
import {
  viewerCapabilitySourceEquals,
  type ViewerCapabilityRequest,
} from "../client/host_capability_descriptor.js";

import { viewerCapabilityRoute } from "./capability_adoption.js";
import {
  commitViewerEvidence,
  type BoundViewerWorkspace,
  type ViewerCapabilitySnapshot,
} from "./capability_commit.js";
import type { ShellState } from "./store_state.js";

interface Current<T> {
  current: T;
}

/** What the store needs to load and adopt one route's private evidence. */
export interface RouteEvidenceInput {
  capabilities: ViewerHostCapabilities | undefined;
  interactive: boolean;
  request: ViewerCapabilityRequest | undefined;
  setSnapshot: Dispatch<SetStateAction<ViewerCapabilitySnapshot>>;
  setState: Dispatch<SetStateAction<ShellState>>;
  snapshotRef: Current<ViewerCapabilitySnapshot>;
  state: ShellState;
  stateRef: Current<ShellState>;
  workspace: BoundViewerWorkspace | undefined;
}

/**
 * Load a newly routed screen or component's private evidence and adopt it
 * atomically. Returns whether that workspace is still expected: true from
 * navigation until adoption, false once adopted or once the request for this
 * exact route and source failed or was rejected. A result that a newer route
 * or source has superseded settles nothing; its successor has its own request.
 */
export function useRouteEvidence(input: RouteEvidenceInput): boolean {
  const {
    capabilities,
    interactive,
    request,
    setSnapshot,
    setState,
    snapshotRef,
    stateRef,
    workspace,
  } = input;
  const [unresolved, setUnresolved] = useState<
    ViewerCapabilityRequest | undefined
  >();
  const target =
    input.state.route.view.kind === "target" && input.state.route.view.target;
  const ownsWorkspace =
    target &&
    target.kind === "entry" &&
    (target.entry.kind === "screen" || target.entry.kind === "component");
  useEffect(() => {
    if (
      !capabilities ||
      !interactive ||
      !request ||
      !ownsWorkspace ||
      sameCapabilityRequest(workspace?.request, request)
    )
      return;
    const controller = new AbortController();
    const settle = () => {
      if (!controller.signal.aborted) setUnresolved(request);
    };
    void capabilities.evidence
      .loadRouteEvidence(request, controller.signal)
      .then((revision) => {
        if (controller.signal.aborted) return;
        if (!revision) return settle();
        const current = snapshotRef.current;
        if (
          !current.source ||
          !viewerCapabilitySourceEquals(current.source, request.source) ||
          viewerCapabilityRoute(stateRef.current.route) !== request.route
        )
          return;
        const commit = commitViewerEvidence(
          current,
          stateRef.current,
          revision,
        );
        if (!commit) return settle();
        snapshotRef.current = commit.snapshot;
        stateRef.current = commit.state;
        setSnapshot(commit.snapshot);
        setState(commit.state);
      })
      .catch(settle);
    return () => controller.abort();
  }, [
    capabilities,
    interactive,
    ownsWorkspace,
    request,
    setSnapshot,
    setState,
    snapshotRef,
    stateRef,
    workspace?.request,
  ]);
  return Boolean(
    ownsWorkspace &&
    request &&
    !sameCapabilityRequest(workspace?.request, request) &&
    !sameCapabilityRequest(unresolved, request),
  );
}

/** Two requests name the same logical route of the same installed source. */
export function sameCapabilityRequest(
  left: ViewerCapabilityRequest | undefined,
  right: ViewerCapabilityRequest,
): boolean {
  return (
    left !== undefined &&
    left.route === right.route &&
    viewerCapabilitySourceEquals(left.source, right.source)
  );
}
