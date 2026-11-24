/** One route-owned workspace supplies preview rendering and shell indicators. */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { viewsUsingComponents } from "../review/shared_impact.js";

import { useCanvasLayout } from "./canvas_layout.js";
import { workspaceShownAxes } from "./frames_filter.js";
import { useShellStore } from "./store_context.js";
import {
  useWorkspaceData,
  type WorkspaceDataState,
} from "./use_workspace_data.js";
import type { EntryStatus } from "./view_status.js";
import {
  selectedVariant,
  type WorkspaceVariantSelection,
} from "./workspace_selection.js";
import {
  resolveWorkspaceView,
  type ResolvedWorkspaceView,
} from "./workspace_views.js";

/** The status and eligibility of the views that the routed workspace shows. */
export interface WorkspacePresentation {
  status: EntryStatus | undefined;
  comparisonEligible: boolean;
  /**
   * The axes keys of the selected views whose usage holds a changed
   * component that the routed entry's detail names.
   */
  usingChanged: ReadonlySet<string>;
}

interface ActiveWorkspace extends WorkspaceDataState {
  presentation: WorkspacePresentation;
  selection: WorkspaceVariantSelection;
  resolvedView: ResolvedWorkspaceView;
}

const WorkspaceContext = createContext<ActiveWorkspace | undefined>(undefined);

/**
 * Share evidence loading and effective-view resolution across the shell.
 * The views that the Frames filter shows, or the compact layout's picked
 * frame, decide the status and the comparison eligibility.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const store = useShellStore();
  const wide = useCanvasLayout();
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
  const hasDark = Boolean(
    data?.views.some((view) => view.colorScheme === "dark"),
  );
  const axes = workspaceShownAxes(
    data?.entry.kind === "component",
    store.state.frames,
    hasDark,
    wide,
    store.state.selection,
  );
  const axesKey = `${axes.viewport}/${axes.schemes.join(",")}`;
  const resolvedView = useMemo(
    () =>
      data && selection
        ? resolveWorkspaceView(data, selection, axes.viewport, axes.schemes)
        : undefined,
    [
      axesKey,
      data,
      data?.affectedComparison,
      data?.status,
      data?.views,
      data?.viewStates,
      selection?.comparisonEligible,
      variant?.status,
      variant?.value.path,
    ],
  );
  const usingChanged = useMemo(
    () =>
      viewsUsingComponents(
        data?.views.filter(
          (view) => view.variantPath === variant?.value.path,
        ) ?? [],
        data?.relatedComponents ?? [],
      ),
    [data?.relatedComponents, data?.views, variant?.value.path],
  );
  const value =
    workspace && selection && resolvedView
      ? {
          ...workspace,
          selection,
          resolvedView,
          presentation: {
            status: resolvedView.status,
            comparisonEligible: resolvedView.comparisonEligible,
            usingChanged,
          },
        }
      : undefined;
  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

/** The selected screen or component workspace; absent on other route kinds. */
export function useActiveWorkspace(): ActiveWorkspace | undefined {
  return useContext(WorkspaceContext);
}
