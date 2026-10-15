/** One route-owned workspace supplies preview rendering and shell indicators. */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useShellStore } from "./store_context.js";
import {
  useWorkspaceData,
  type WorkspaceDataState,
} from "./use_workspace_data.js";
import { viewMarks, type ViewMarks } from "./view_marks.js";
import type { EntryStatus } from "./view_status.js";
import { workspaceEvidenceEntry } from "./workspace_entry.js";
import {
  selectedVariant,
  type WorkspaceVariantSelection,
} from "./workspace_selection.js";
import {
  resolveWorkspaceView,
  type ResolvedWorkspaceView,
} from "./workspace_views.js";
import { selectedChangedViews } from "./workspace_views_data.js";

/** The status, eligibility and change marks the routed workspace shows. */
export interface WorkspacePresentation {
  status: EntryStatus | undefined;
  comparisonEligible: boolean;
  marks: ViewMarks;
}

interface ActiveWorkspace extends WorkspaceDataState {
  marks: ViewMarks;
  presentation: WorkspacePresentation;
  selection: WorkspaceVariantSelection;
  resolvedView: ResolvedWorkspaceView;
}

const WorkspaceContext = createContext<ActiveWorkspace | undefined>(undefined);

/** Share evidence loading and effective-view resolution across the shell. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const store = useShellStore();
  const route = store.state.route;
  const target = route.view.kind === "target" ? route.view.target : undefined;
  const entry =
    target?.kind === "entry" &&
    (target.entry.kind === "screen" || target.entry.kind === "component")
      ? target.entry
      : undefined;
  const workspace = useWorkspaceData(store.catalogue, store.context, entry);
  const data = workspace?.data;
  const selection = data ? selectedVariant(data) : undefined;
  const variant = selection?.variant;
  const { viewport, colorScheme } = store.state.selection;
  const resolvedView = useMemo(
    () =>
      data && selection
        ? resolveWorkspaceView(data, selection, viewport, colorScheme)
        : undefined,
    [
      colorScheme,
      data,
      data?.status,
      data?.views,
      data?.viewStates,
      selection?.comparisonEligible,
      variant?.status,
      variant?.value.path,
      viewport,
    ],
  );
  const presentation: WorkspacePresentation | undefined =
    workspace && resolvedView
      ? {
          status: resolvedView.status,
          comparisonEligible: resolvedView.comparisonEligible,
          marks: viewMarks(
            selectedChangedViews(
              workspaceEvidenceEntry(workspace.data),
              workspace.data.changedViews,
              variant?.value.path,
            ),
            viewport,
            resolvedView.colorScheme,
          ),
        }
      : undefined;
  const value =
    workspace && selection && resolvedView && presentation
      ? {
          ...workspace,
          selection,
          resolvedView,
          presentation,
          marks: presentation.marks,
        }
      : undefined;
  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

/** The selected screen or component workspace; absent on other route kinds. */
export function useActiveWorkspace(): ActiveWorkspace | undefined {
  return useContext(WorkspaceContext);
}
