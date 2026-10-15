/** The routed workspace, built from the index and the routed entry's detail. */

import { useMemo, useRef } from "react";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { useRouteDelivery } from "./data_context.js";
import type { DetailDelivery } from "./data_requests.js";
import { workspaceData, type WorkspaceData } from "./workspace_data.js";
import { mergeWorkspaceEvidence } from "./workspace_evidence_merge.js";

/** The workspace values and the delivery of the detail they come from. */
export interface WorkspaceDataState {
  data: WorkspaceData;
  usageDelivery: UsageDeliveryState;
}

/** The delivery of the lists that only the entry detail carries. */
export type UsageDeliveryState = DetailDelivery;

/**
 * Keep one entry-owned workspace object across detail and publication
 * updates, so local editor state and inspector choices survive them.
 */
export function useWorkspaceData(
  catalogue: Catalogue,
  context: ShellContext,
  entry: WorkspaceData["entry"] | undefined,
): WorkspaceDataState | undefined {
  const delivery = useRouteDelivery();
  const selected = useMemo(
    () => (entry ? workspaceData(catalogue, context, entry) : undefined),
    [catalogue, context, entry],
  );
  const dataRef = useRef(selected);
  const adoptedRef = useRef(selected);
  if (!matchingWorkspace(dataRef.current, entry)) {
    dataRef.current = selected;
    adoptedRef.current = selected;
  } else if (dataRef.current && selected && adoptedRef.current !== selected) {
    mergeWorkspaceEvidence(dataRef.current, selected);
    adoptedRef.current = selected;
  }
  return dataRef.current
    ? { data: dataRef.current, usageDelivery: delivery ?? { status: "ready" } }
    : undefined;
}

function matchingWorkspace(
  data: WorkspaceData | undefined,
  entry: WorkspaceData["entry"] | undefined,
): data is WorkspaceData {
  return (
    entry !== undefined &&
    data?.entry.path === entry.path &&
    data.entry.kind === entry.kind
  );
}
