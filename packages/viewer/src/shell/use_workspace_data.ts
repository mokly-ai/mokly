/** Route-scoped private workspace evidence layered over the public catalogue. */

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { catalogueHasOmittedUsage } from "../catalogue/usage_scope.js";
import type { ViewerCapabilityRequest } from "../client/host_capability_descriptor.js";

import {
  useStaticWorkspaceEvidence,
  useViewerInitialWorkspace,
  useViewerLiveState,
} from "./capability_context.js";
import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { workspaceData, type WorkspaceData } from "./workspace_data.js";
import { mergeWorkspaceEvidence } from "./workspace_evidence_merge.js";

/** Current evidence plus the live request that owns any follow-up work. */
export interface RoutedWorkspaceData {
  data: WorkspaceData;
  refresh(): void;
  request?: ViewerCapabilityRequest;
  usageDelivery: UsageDeliveryState;
}

/** Cross-route Usage delivery, distinct from catalogue usage availability. */
export type UsageDeliveryState =
  | { status: "ready" }
  | { status: "loading" }
  | { status: "failed"; retry(): void };

/** Select atomically adopted private evidence, then fall back to public data. */
export function useWorkspaceData(
  catalogue: Catalogue,
  context: ShellContext,
  entry: WorkspaceData["entry"] | undefined,
): RoutedWorkspaceData | undefined {
  const live = useViewerLiveState();
  const initial = useViewerInitialWorkspace();
  const staticEvidence = useStaticWorkspaceEvidence();
  const [staticWorkspace, setStaticWorkspace] = useState<
    WorkspaceData | undefined
  >();
  const fallback = useMemo(
    () => (entry ? workspaceData(catalogue, context, entry) : undefined),
    [catalogue, context, entry],
  );
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  const privateWorkspace = matchingWorkspace(live.workspace, entry)
    ? live.workspace
    : matchingWorkspace(staticWorkspace, entry)
      ? staticWorkspace
      : matchingWorkspace(initial, entry)
        ? initial
        : undefined;
  const selected = privateWorkspace ?? fallback;
  const dataRef = useRef(selected);
  const adoptedRef = useRef(selected);
  if (!matchingWorkspace(dataRef.current, entry)) {
    dataRef.current = selected;
    adoptedRef.current = selected;
  } else if (dataRef.current && selected && adoptedRef.current !== selected) {
    mergeWorkspaceEvidence(dataRef.current, selected);
    adoptedRef.current = selected;
  }

  useEffect(() => {
    if (
      !entry ||
      !staticEvidence ||
      matchingWorkspace(initial, entry) ||
      matchingWorkspace(staticWorkspace, entry)
    )
      return;
    const controller = new AbortController();
    void staticEvidence
      .loadWorkspace(entry, controller.signal)
      .then((workspace) => {
        if (
          !controller.signal.aborted &&
          workspace &&
          matchingWorkspace(workspace, entry)
        )
          setStaticWorkspace(workspace);
      });
    return () => controller.abort();
  }, [entry, initial, staticEvidence, staticWorkspace]);

  const incomplete = Boolean(
    catalogue.publicModel && catalogueHasOmittedUsage(catalogue.publicModel),
  );
  const usageDelivery: UsageDeliveryState =
    privateWorkspace || !incomplete
      ? { status: "ready" }
      : live.routeEvidence?.status === "failed"
        ? { status: "failed", retry: live.routeEvidence.retry }
        : { status: "loading" };
  return dataRef.current
    ? {
        data: dataRef.current,
        refresh,
        usageDelivery,
        ...(live.request ? { request: live.request } : {}),
      }
    : undefined;
}

function matchingWorkspace(
  data: WorkspaceData | undefined,
  entry: WorkspaceData["entry"] | undefined,
): data is WorkspaceData {
  return (
    entry !== undefined &&
    data?.entry.id === entry.id &&
    data.entry.kind === entry.kind &&
    data.entry.route === entry.route
  );
}
