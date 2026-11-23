/**
 * One bounded component/screen workspace: the canvas with its frames, and
 * the right panel with Inspect and Changes. The compact layout's entry bar
 * names the entry over the canvas and picks its one frame, and the pill
 * above the dock names the canvas selection.
 */

import { useMemo, useRef } from "react";

import { ChangeStatus } from "@mokly/ui/change-status";
import { EntryBar } from "@mokly/ui/entry-bar";
import { WorkspaceLayout } from "@mokly/ui/workspace-layout";

import { canvasEditContexts, withEditPreviews } from "./canvas_frames.js";
import { usePreviousVersionLabel } from "./canvas_removed_section.js";
import type { Catalogue } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import { ComparisonCanvas } from "./comparison_canvas.js";
import { useComparedFrameChoice } from "./comparison_compared_frame.js";
import {
  comparisonFrames,
  comparisonOffered,
} from "./comparison_eligible_frames.js";
import { comparisonEligibilityKnown } from "./comparison_intent.js";
import { useComponentControls } from "./component_controls.js";
import type { ShellContext } from "./context.js";
import { controlTarget } from "./control_values.js";
import { FrameStageContext } from "./frame_layout_context.js";
import { targetHead } from "./head.js";
import { removedPreviewData, RemovedPreviewStage } from "./previews.js";
import { useRetryFocus } from "./retry_focus.js";
import { shownPanelTab } from "./right_panel.js";
import { useShellStore } from "./store_context.js";
import { useComparison } from "./use_comparison.js";
import { useWorkspaceComparison } from "./workspace_comparison.js";
import { useActiveWorkspace } from "./workspace_context.js";
import type { WorkspaceData } from "./workspace_data.js";
import { workspaceEvidenceEntry } from "./workspace_entry.js";
import { useWorkspaceInspection } from "./workspace_inspection.js";
import { WorkspacePanel } from "./workspace_panel.js";
import { useWorkspacePicks } from "./workspace_picks.js";
import { useWorkspaceSelection } from "./workspace_selection_view.js";
import { WorkspaceStage } from "./workspace_stage.js";
import { selectedChangedViews } from "./workspace_views_data.js";

/** Render a routed screen or component with its evidence and inspection tools. */
export function ComponentWorkspace({
  catalogue,
  context,
  entry,
}: {
  catalogue: Catalogue;
  context: ShellContext;
  entry: WorkspaceData["entry"];
}) {
  const store = useShellStore();
  const workspaceRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLInputElement>(null);
  const workspace = useActiveWorkspace();
  if (!workspace) throw new Error("The active workspace is unavailable.");
  const { data, selection, resolvedView, presentation } = workspace;
  const variant = selection.variant;
  const variantPath = variant?.value.path;
  const previousPath = branchPoints(catalogue).previousPath(
    variant?.value ?? entry,
  );
  const changedViews = selectedChangedViews(
    workspaceEvidenceEntry(data),
    data.changedViews,
    variantPath,
  );
  const savedViews = resolvedView.views;
  const set = entry.kind === "component";
  // The tab needs the canvas's frames, which decide a set's compare, so a
  // click and the Escape key read the shown tab when they arrive.
  const inspecting = useRef(false);
  const { canvas, chosenRow, onPick, picks, wide } = useWorkspacePicks({
    data,
    entry,
    selecting: () => inspecting.current,
  });
  const choice = useComparedFrameChoice();
  const historical = data.removed || variant?.removed === true;
  // Each shown row that compares gets its own generation. A removed entry
  // has no live frames, so its own row compares alone.
  const compared = historical
    ? undefined
    : comparisonFrames(data, catalogue.publicModel.details, canvas.frames);
  const offered = comparisonOffered({
    comparisons: data.comparisons,
    frames: compared,
    routedEligible: presentation.comparisonEligible,
    set,
  });
  const changes =
    store.context.changedEntries?.includes(entry.path) === true || offered;
  const tab = shownPanelTab(store.state.panelTab, changes);
  inspecting.current = tab === "inspect" && !data.removed;
  const comparison = useComparison({
    ...(choice.chosen === undefined ? {} : { comparedFrame: choice.chosen }),
    effectiveColorScheme: resolvedView.colorScheme,
    eligible: offered,
    eligibilityKnown: comparisonEligibilityKnown(
      catalogue.publicModel.changesStatus,
      workspace.detailDelivery,
    ),
    ...(compared ? { frames: compared } : {}),
    historical,
    entryId: variantPath ?? entry.path,
    ...(data.component ? { owner: data.component.path } : {}),
  });
  // The canvas shows the chosen compare mode only while Changes is the
  // selected tab, so Inspect, its highlight and its Props see the current
  // frames, and the mode and the loaded comparison stay for Changes.
  const comparing = tab === "changes" && comparison.mode !== "current";
  const picked = picks.state;
  // Props on a variant set edit the variant of the selected frame.
  const editTarget = controlTarget(
    entry,
    set ? chosenRow : variant,
    data.removed,
    data.controlOrder,
  );
  // An edit renders each shown frame of the edited screen or row.
  const editRow =
    editTarget?.kind === "component" ? editTarget.path : undefined;
  const contexts = useMemo(
    () => canvasEditContexts(data.views, canvas.frames, editRow, savedViews),
    [canvas.frames, data.views, editRow, savedViews],
  );
  const propsRecovery = useRetryFocus();
  const controls = useComponentControls({
    comparing,
    contexts,
    data,
    onCurrent: () => comparison.selectMode("current"),
    recovery: propsRecovery,
    target: editTarget,
    workspaceRef,
  });
  const frames = useMemo(
    () =>
      withEditPreviews(canvas.frames, controls.previewViews).map((frame) => ({
        ...frame,
        selected: tab === "inspect" && frame.key === picked.selected?.frame,
      })),
    [canvas.frames, controls.previewViews, picked.selected, tab],
  );
  const views = useWorkspaceSelection({
    data,
    frames,
    onPick,
    picks,
    previewViews: controls.previewViews,
    tab,
    wide,
  });
  const inspection = useWorkspaceInspection({
    workspaceRef,
    highlightRef,
    comparisonActive: comparing,
    data,
    invalidSelection: Boolean(data.removed || variant?.removed),
    onLabel: views.selectLabel,
    views: views.shown,
  });
  const target = { kind: "entry" as const, entry };
  const head = targetHead(catalogue, target);
  const headStatus =
    data.component?.path === entry.path ? data.status : presentation.status;
  const compare = useWorkspaceComparison({
    choice,
    compared,
    comparison,
    data,
    frames,
    head,
    status: headStatus,
    usingChanged: presentation.usingChanged,
    variant,
  });
  const preview = data.removed
    ? removedPreviewData(catalogue, context, entry)
    : undefined;
  const previous = usePreviousVersionLabel(
    preview,
    store.state.selection.colorScheme,
  );
  const stage = (
    <WorkspaceStage
      canvas={{
        ...views.canvas,
        fitKey: canvas.fitKey,
        frames,
        status: headStatus,
      }}
      catalogue={catalogue}
      context={context}
      data={data}
      target={target}
      variantRemoved={variant?.removed ?? false}
    />
  );

  return (
    <WorkspaceLayout
      busy={controls.pending}
      entryBar={
        <EntryBar
          component={entry.kind === "component"}
          picker={canvas.picker}
          quietLabel={previous.label}
          status={<ChangeStatus status={headStatus} />}
          title={head.title}
        />
      }
      overlay={
        <>
          {inspection.overlay}
          {views.pill}
        </>
      }
      panel={
        <WorkspacePanel
          input={{
            catalogue,
            changedViews,
            changes,
            compare,
            compared: comparison.loaded !== undefined,
            controls: controls.panel,
            data,
            delivery: workspace.detailDelivery,
            eligible: offered,
            frames: {
              changed: changedViews,
              choice: canvas.choice,
              count: canvas.shownCount,
              hasDark: canvas.hasDark,
              viewports: !set,
            },
            highlight: {
              onHighlight: inspection.toggle,
              ref: highlightRef,
              state: {
                active: inspection.highlighting,
                available: inspection.available,
                reason: inspection.reason,
              },
            },
            instances: views.instances,
            onFrames: views.toggleFrames,
            previousPath,
            propsFocus: propsRecovery,
            removedScreen: preview !== undefined,
            reveal: picked.reveal,
            routed: entry,
            selection: views.details,
            set: set
              ? { ...views.set, chosen: chosenRow?.value.path }
              : undefined,
            settled: comparisonEligibilityKnown(
              catalogue.publicModel.changesStatus,
              workspace.detailDelivery,
            ),
            status: headStatus,
            target: editTarget,
            variantPath,
          }}
        />
      }
      previewRef={previewRef}
      preview={
        <FrameStageContext value={previewRef}>
          {preview ? (
            <RemovedPreviewStage data={preview} onShown={previous.onShown} />
          ) : data.comparisons ? (
            <ComparisonCanvas {...compare.canvas} shown={tab === "changes"}>
              {stage}
            </ComparisonCanvas>
          ) : (
            stage
          )}
        </FrameStageContext>
      }
      previewStatus={controls.previewStatus}
      ref={workspaceRef}
    />
  );
}
