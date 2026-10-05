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
  viewerCapabilityEntryPath,
} from "./capability_adoption.js";
import {
  commitViewerEvidence,
  type ViewerCapabilitySnapshot,
} from "./capability_commit.js";
import {
  useViewerCapabilities,
  useViewerInitialInteractive,
  useViewerInitialRebuildStatus,
  useViewerInitialSource,
  useViewerInitialWorkspace,
  type ViewerLiveState,
} from "./capability_context.js";
import { adoptViewerRebuildStatus } from "./capability_rebuild_status.js";
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
  const initialRebuildStatus = useViewerInitialRebuildStatus();
  const initialWorkspace = useViewerInitialWorkspace();
  const initialRequest = capabilityRequest(
    capabilities?.source ?? initialSource,
    input.state,
  );
  const [snapshot, setSnapshot] = useState<ViewerCapabilitySnapshot>(() => ({
    catalogue: input.catalogue,
    ...(initialInteractive ? { interactive: initialInteractive } : {}),
    ...(initialRebuildStatus ? { rebuildStatus: initialRebuildStatus } : {}),
    ...(initialRequest ? { routeEvidence: initialRequest } : {}),
    ...(initialRequest ? { source: initialRequest.source } : {}),
    ...(initialRequest &&
    initialWorkspace?.entry.path === initialRequest.entryPath
      ? { workspace: { request: initialRequest, value: initialWorkspace } }
      : {}),
  }));
  const snapshotRef = useRef(snapshot);
  const recoveryRef = useRef(input.captureRecovery);
  snapshotRef.current = snapshot;
  recoveryRef.current = input.captureRecovery;

  const entryPath = viewerCapabilityEntryPath(input.state.route);
  const request = useMemo(
    () =>
      snapshot.source
        ? viewerCapabilityRequest(snapshot.source, entryPath)
        : undefined,
    [entryPath, snapshot.source],
  );
  const workspace =
    request && sameCapabilityRequest(snapshot.workspace?.request, request)
      ? snapshot.workspace?.value
      : undefined;

  const routeEvidence = useRouteEvidence({
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
  const adoptRebuildStatus = useCallback(
    (candidate: NonNullable<ViewerLiveState["rebuildStatus"]>) =>
      setSnapshot((current) => {
        if (!current.source) return current;
        const adopted = adoptViewerRebuildStatus(
          current,
          current.source.updateVersion,
          candidate,
        );
        if (
          adopted.rebuildStatus === current.rebuildStatus &&
          adopted.pendingRebuildStatus === current.pendingRebuildStatus
        )
          return current;
        const next = { ...current, ...adopted };
        if (!adopted.pendingRebuildStatus) delete next.pendingRebuildStatus;
        if (!adopted.rebuildStatus) delete next.rebuildStatus;
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
        adoptRebuildStatus,
        adoptEvidence(revision) {
          if (controller.signal.aborted) return true;
          const current = snapshotRef.current;
          const currentEntryPath = viewerCapabilityEntryPath(
            input.stateRef.current.route,
          );
          if (
            !current.source ||
            !viewerCapabilitySourceEquals(current.source, request.source) ||
            currentEntryPath !== request.entryPath
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
    adoptRebuildStatus,
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
      ...(snapshot.rebuildStatus
        ? { rebuildStatus: snapshot.rebuildStatus }
        : {}),
      ...(request ? { request } : {}),
      ...(routeEvidence ? { routeEvidence } : {}),
      ...(workspace ? { workspace } : {}),
      ...(routeEvidence?.status === "loading"
        ? { workspacePending: true as const }
        : {}),
    }),
    [
      adoptPreparation,
      capabilities,
      request,
      routeEvidence,
      snapshot.interactive,
      snapshot.rebuildStatus,
      workspace,
    ],
  );
  return { catalogue: snapshot.catalogue, context, liveState };
}

function capabilityRequest(
  source: ViewerCapabilitySource | undefined,
  state: ShellState,
): ViewerCapabilityRequest | undefined {
  return source
    ? viewerCapabilityRequest(source, viewerCapabilityEntryPath(state.route))
    : undefined;
}
