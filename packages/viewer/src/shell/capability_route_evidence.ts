/** Route-scoped private evidence adopted with the page's exact public scope. */
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { ViewerHostCapabilities } from "../client/host_capabilities.js";
import {
  viewerCapabilitySourceEquals,
  type ViewerCapabilityRequest,
} from "../client/host_capability_descriptor.js";

import { viewerCapabilityEntryId } from "./capability_adoption.js";
import {
  commitViewerEvidence,
  type BoundViewerWorkspace,
  type ViewerCapabilitySnapshot,
} from "./capability_commit.js";
import type { ViewerRouteEvidenceState } from "./capability_context.js";
import type { ShellState } from "./store_state.js";
interface Current<T> {
  current: T;
}
/** Inputs bound to the current route and source revision. */
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
/** Load all target routes; expose retryable delivery state without stale fallbacks. */
export function useRouteEvidence(
  input: RouteEvidenceInput,
): ViewerRouteEvidenceState | undefined {
  const {
    capabilities,
    interactive,
    request,
    setSnapshot,
    setState,
    snapshotRef,
    state,
    stateRef,
    workspace,
  } = input;
  const target = state.route.view.kind === "target" && state.route.view.target;
  const ownsWorkspace =
    target &&
    target.kind === "entry" &&
    (target.entry.kind === "screen" || target.entry.kind === "component");
  const [failedRequest, setFailedRequest] = useState<
    ViewerCapabilityRequest | undefined
  >();
  const [attempt, retryAttempt] = useReducer((value: number) => value + 1, 0);
  const retry = useCallback(() => {
    setFailedRequest(undefined);
    retryAttempt();
  }, []);
  const routeReady = Boolean(
    request &&
    sameCapabilityRequest(snapshotRef.current.routeEvidence, request),
  );
  const workspaceReady = Boolean(
    !ownsWorkspace ||
    (request && sameCapabilityRequest(workspace?.request, request)),
  );
  const ready = routeReady && workspaceReady;
  const failed = Boolean(
    request && failedRequest && sameCapabilityRequest(failedRequest, request),
  );
  useEffect(() => {
    if (!capabilities || !interactive || !request || !target || ready) return;
    const controller = new AbortController();
    void capabilities.evidence
      .loadRouteEvidence(request, controller.signal)
      .then((revision) => {
        if (controller.signal.aborted) return;
        const current = snapshotRef.current;
        if (!currentRequestOwns(current, stateRef.current, request)) return;
        if (!revision) {
          setFailedRequest(request);
          return;
        }
        const commit = commitViewerEvidence(
          current,
          stateRef.current,
          revision,
        );
        if (!commit) {
          setFailedRequest(request);
          return;
        }
        snapshotRef.current = commit.snapshot;
        stateRef.current = commit.state;
        setFailedRequest(undefined);
        setSnapshot(commit.snapshot);
        setState(commit.state);
      })
      .catch(() => {
        if (
          !controller.signal.aborted &&
          currentRequestOwns(snapshotRef.current, stateRef.current, request)
        )
          setFailedRequest(request);
      });
    return () => controller.abort();
  }, [
    attempt,
    capabilities,
    interactive,
    ready,
    request,
    setSnapshot,
    setState,
    snapshotRef,
    stateRef,
    target,
  ]);
  return useMemo(
    () =>
      request && target
        ? { status: ready ? "ready" : failed ? "failed" : "loading", retry }
        : undefined,
    [failed, ready, request, retry, target],
  );
}

function currentRequestOwns(
  snapshot: ViewerCapabilitySnapshot,
  state: ShellState,
  request: ViewerCapabilityRequest,
): boolean {
  return Boolean(
    snapshot.source &&
    viewerCapabilitySourceEquals(snapshot.source, request.source) &&
    viewerCapabilityEntryId(state.route) === request.entryId,
  );
}

/** Two requests name the same logical entry of the same installed source. */
export function sameCapabilityRequest(
  left: ViewerCapabilityRequest | undefined,
  right: ViewerCapabilityRequest,
): boolean {
  return (
    left !== undefined &&
    left.entryId === right.entryId &&
    viewerCapabilitySourceEquals(left.source, right.source)
  );
}
