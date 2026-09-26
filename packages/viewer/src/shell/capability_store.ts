/** React-store integration for optional live host capabilities. */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { ViewerHostCapabilities } from "../client/host_capabilities.js";
import {
  viewerCapabilityRequest,
  viewerCapabilitySourceEquals,
  type ViewerCapabilityRequest,
  type ViewerCapabilitySource,
} from "../client/host_capability_descriptor.js";

import {
  shellContextWithViewerEvidence,
  viewerCapabilityRoute,
} from "./capability_adoption.js";
import {
  commitViewerEvidence,
  type BoundViewerWorkspace,
  type ViewerCapabilitySnapshot,
} from "./capability_commit.js";
import {
  useViewerCapabilities,
  useViewerInitialSource,
  useViewerInitialWorkspace,
  type ViewerLiveState,
  type ViewerRouteEvidenceState,
} from "./capability_context.js";
import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { ShellRecoverySnapshot, ShellState } from "./store_state.js";

interface Current<T> {
  current: T;
}

/** Dynamic evidence consumed by the shell provider and exposed to descendants. */
export interface ViewerCapabilityStore {
  catalogue: Catalogue;
  context: ShellContext;
  liveState: ViewerLiveState;
}

/** Own subscriptions, route evidence and atomic public/private revision adoption. */
export function useViewerCapabilityStore(input: {
  captureRecovery(): ShellRecoverySnapshot;
  catalogue: Catalogue;
  context: ShellContext;
  interactive: boolean;
  setState: Dispatch<SetStateAction<ShellState>>;
  state: ShellState;
  stateRef: Current<ShellState>;
}): ViewerCapabilityStore {
  const capabilities = useViewerCapabilities();
  const initialSource = useViewerInitialSource();
  const initialWorkspace = useViewerInitialWorkspace();
  const initialRequest = capabilityRequest(
    capabilities?.source ?? initialSource,
    input.state,
  );
  const [snapshot, setSnapshot] = useState<ViewerCapabilitySnapshot>(() => ({
    catalogue: input.catalogue,
    ...(initialRequest ? { routeEvidence: initialRequest } : {}),
    ...(initialRequest ? { source: initialRequest.source } : {}),
    ...(initialRequest && initialWorkspace?.entry.route === initialRequest.route
      ? { workspace: { request: initialRequest, value: initialWorkspace } }
      : {}),
  }));
  const snapshotRef = useRef(snapshot);
  const recoveryRef = useRef(input.captureRecovery);
  snapshotRef.current = snapshot;
  recoveryRef.current = input.captureRecovery;

  const route = viewerCapabilityRoute(input.state.route);
  const request = useMemo(
    () =>
      snapshot.source
        ? viewerCapabilityRequest(snapshot.source, route)
        : undefined,
    [route, snapshot.source],
  );
  const workspace =
    request && sameRequest(snapshot.workspace?.request, request)
      ? snapshot.workspace?.value
      : undefined;

  const routeEvidence = useRouteEvidence(
    capabilities,
    input.interactive,
    input.state,
    input.stateRef,
    request,
    snapshot.workspace,
    snapshotRef,
    setSnapshot,
    input.setState,
  );

  useEffect(() => {
    if (!capabilities || !input.interactive || !request) return;
    const controller = new AbortController();
    capabilities.updates.subscribe(
      request,
      {
        adoptEvidence(revision) {
          if (controller.signal.aborted) return true;
          const current = snapshotRef.current;
          const currentRoute = viewerCapabilityRoute(
            input.stateRef.current.route,
          );
          if (
            !current.source ||
            !viewerCapabilitySourceEquals(current.source, request.source) ||
            currentRoute !== request.route
          )
            return true;
          const commit = commitViewerEvidence(
            current,
            input.stateRef.current,
            revision,
          );
          if (!commit) return false;
          snapshotRef.current = commit.snapshot;
          input.stateRef.current = commit.state;
          setSnapshot(commit.snapshot);
          input.setState(commit.state);
          return true;
        },
        captureRecovery: () => recoveryRef.current(),
      },
      controller.signal,
    );
    return () => controller.abort();
  }, [
    capabilities,
    input.interactive,
    input.setState,
    input.stateRef,
    request,
  ]);

  const context = snapshot.source
    ? shellContextWithViewerEvidence(
        input.context,
        snapshot.catalogue,
        snapshot.source,
        input.state,
      )
    : input.context;
  const liveState = useMemo<ViewerLiveState>(
    () => ({
      ...(capabilities ? { capabilities } : {}),
      ...(request ? { request } : {}),
      ...(routeEvidence ? { routeEvidence } : {}),
      ...(workspace ? { workspace } : {}),
    }),
    [capabilities, request, routeEvidence, workspace],
  );
  return { catalogue: snapshot.catalogue, context, liveState };
}

function useRouteEvidence(
  capabilities: ViewerHostCapabilities | undefined,
  interactive: boolean,
  state: ShellState,
  stateRef: Current<ShellState>,
  request: ViewerCapabilityRequest | undefined,
  workspace: BoundViewerWorkspace | undefined,
  snapshotRef: { current: ViewerCapabilitySnapshot },
  setSnapshot: Dispatch<SetStateAction<ViewerCapabilitySnapshot>>,
  setState: Dispatch<SetStateAction<ShellState>>,
): ViewerRouteEvidenceState | undefined {
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
    request && sameRequest(snapshotRef.current.routeEvidence, request),
  );
  const workspaceReady = Boolean(
    !ownsWorkspace || (request && sameRequest(workspace?.request, request)),
  );
  const ready = routeReady && workspaceReady;
  const failed = Boolean(
    request && failedRequest && sameRequest(failedRequest, request),
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
    viewerCapabilityRoute(state.route) === request.route,
  );
}

function capabilityRequest(
  source: ViewerCapabilitySource | undefined,
  state: ShellState,
): ViewerCapabilityRequest | undefined {
  return source
    ? viewerCapabilityRequest(source, viewerCapabilityRoute(state.route))
    : undefined;
}

function sameRequest(
  left: ViewerCapabilityRequest | undefined,
  right: ViewerCapabilityRequest,
): boolean {
  return (
    left !== undefined &&
    left.route === right.route &&
    viewerCapabilitySourceEquals(left.source, right.source)
  );
}
