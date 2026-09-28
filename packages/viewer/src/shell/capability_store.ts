/** React-store integration for optional live host capabilities. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  viewerCapabilityRequest,
  viewerCapabilitySourceEquals,
  type ViewerCapabilityRequest,
  type ViewerCapabilitySource,
} from "../client/host_capability_descriptor.js";
import {
  advancedViewerInteractive,
  sameViewerInteractiveOrigin,
  type InteractivePrepareResponse,
  type ViewerInteractiveDescriptor,
} from "../client/interactive_capability.js";

import {
  shellContextWithViewerEvidence,
  viewerCapabilityRoute,
} from "./capability_adoption.js";
import {
  commitViewerEvidence,
  type ViewerCapabilitySnapshot,
} from "./capability_commit.js";
import {
  useViewerCapabilities,
  useViewerInitialInteractive,
  useViewerInitialSource,
  useViewerInitialWorkspace,
  type ViewerLiveState,
} from "./capability_context.js";
import {
  sameCapabilityRequest,
  useRouteEvidence,
} from "./capability_route_evidence.js";
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
  const initialInteractive = useViewerInitialInteractive();
  const initialWorkspace = useViewerInitialWorkspace();
  const initialRequest = capabilityRequest(
    capabilities?.source ?? initialSource,
    input.state,
  );
  const [snapshot, setSnapshot] = useState<ViewerCapabilitySnapshot>(() => ({
    catalogue: input.catalogue,
    ...(initialInteractive ? { interactive: initialInteractive } : {}),
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
    request && sameCapabilityRequest(snapshot.workspace?.request, request)
      ? snapshot.workspace?.value
      : undefined;

  const workspacePending = useRouteEvidence({
    capabilities,
    interactive: input.interactive,
    request,
    setSnapshot,
    setState: input.setState,
    snapshotRef,
    state: input.state,
    stateRef: input.stateRef,
    workspace: snapshot.workspace,
  });

  const adoptInteractive = useCallback(
    (interactive: ViewerInteractiveDescriptor) =>
      setSnapshot((current) => {
        if (!sameViewerInteractiveOrigin(current.interactive, interactive))
          return current;
        const adopted = advancedViewerInteractive(
          current.interactive,
          interactive,
        );
        if (adopted === current.interactive) return current;
        const next = { ...current, interactive: adopted };
        snapshotRef.current = next;
        return next;
      }),
    [],
  );
  const adoptPreparation = useCallback(
    (result: InteractivePrepareResponse) =>
      setSnapshot((current) => {
        const installed = current.interactive;
        if (installed?.generation !== result.generation) return current;
        const adopted = advancedViewerInteractive(installed, {
          ...installed,
          state: result.state,
        });
        if (adopted === installed) return current;
        const next = { ...current, interactive: adopted };
        snapshotRef.current = next;
        return next;
      }),
    [],
  );

  useEffect(() => {
    if (!capabilities || !input.interactive || !request) return;
    const controller = new AbortController();
    capabilities.updates.subscribe(
      request,
      {
        adoptInteractive,
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
    adoptInteractive,
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
      adoptPreparation,
      ...(capabilities ? { capabilities } : {}),
      ...(snapshot.interactive ? { interactive: snapshot.interactive } : {}),
      ...(request ? { request } : {}),
      ...(workspace ? { workspace } : {}),
      ...(workspacePending ? { workspacePending: true as const } : {}),
    }),
    [
      adoptPreparation,
      capabilities,
      request,
      snapshot.interactive,
      workspace,
      workspacePending,
    ],
  );
  return { catalogue: snapshot.catalogue, context, liveState };
}

function capabilityRequest(
  source: ViewerCapabilitySource | undefined,
  state: ShellState,
): ViewerCapabilityRequest | undefined {
  return source
    ? viewerCapabilityRequest(source, viewerCapabilityRoute(state.route))
    : undefined;
}
