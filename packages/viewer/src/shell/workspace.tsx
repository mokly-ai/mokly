/**
 * One bounded component/screen workspace: the canvas with its frames, and
 * the right panel with the head, the comparison band, the variant bar and
 * the inspector. The compact layout's entry bar names the entry over the
 * canvas and picks its one frame.
 */

import { useMemo, useRef } from "react";

import { ChangeStatus } from "@mokly/ui/change-status";
import { EntryBar } from "@mokly/ui/entry-bar";
import type { InspectorHandle } from "@mokly/ui/inspector";
import { WorkspaceLayout } from "@mokly/ui/workspace-layout";

import {
  canvasEditContexts,
  framesViews,
  withEditPreviews,
} from "./canvas_frames.js";
import { usePreviousVersionLabel } from "./canvas_removed_section.js";
import type { Catalogue } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import { comparisonEligibilityKnown } from "./comparison_intent.js";
import { useComponentControls } from "./component_controls.js";
import type { ShellContext } from "./context.js";
import { controlTarget } from "./control_values.js";
import { ComparisonBand, ControlledDiffScreen } from "./diffs.js";
import { FrameStageContext } from "./frame_layout_context.js";
import { ScreenHead, targetHead } from "./head.js";
import { removedPreviewData, RemovedPreviewStage } from "./previews.js";
import { useRetryFocus } from "./retry_focus.js";
import { RightPanel } from "./sheets.js";
import { useShellStore } from "./store_context.js";
import { useComparison } from "./use_comparison.js";
import { useWorkspaceCanvas } from "./workspace_canvas.js";
import { useActiveWorkspace } from "./workspace_context.js";
import { WorkspaceControls } from "./workspace_controls.js";
import type { WorkspaceData } from "./workspace_data.js";
import { workspaceEvidenceEntry } from "./workspace_entry.js";
import { useWorkspaceInspection } from "./workspace_inspection.js";
import { WorkspaceInspector } from "./workspace_inspector.js";
import { useWorkspaceInstanceSelection } from "./workspace_instance_selection.js";
import { WorkspacePropsTab } from "./workspace_props.js";
import { WorkspaceStage } from "./workspace_stage.js";
import { WorkspaceVariantBar } from "./workspace_variant_bar.js";
import { visibleWorkspaceViews } from "./workspace_views.js";
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
  const inspectorRef = useRef<InspectorHandle>(null);
  const highlightRef = useRef<HTMLButtonElement>(null);
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
  const { colorScheme, viewport } = store.state.selection;
  const savedViews = resolvedView.views;
  const comparison = useComparison({
    effectiveColorScheme: resolvedView.colorScheme,
    eligible: Boolean(data.comparisons && presentation.comparisonEligible),
    eligibilityKnown: comparisonEligibilityKnown(
      catalogue.publicModel.changesStatus,
      workspace.detailDelivery,
    ),
    historical: data.removed || variant?.removed === true,
    entryId: variantPath ?? entry.path,
    ...(data.component ? { owner: data.component.path } : {}),
  });
  const comparing = comparison.mode !== "current";
  const editTarget = controlTarget(
    entry,
    variant,
    data.removed,
    data.controlOrder,
  );
  const canvas = useWorkspaceCanvas(data);
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
  const views = useMemo(
    () =>
      visibleWorkspaceViews(
        { ...data, views: controls.previewViews },
        variantPath,
        viewport,
        colorScheme,
      ),
    [colorScheme, controls.previewViews, data, variantPath, viewport],
  );
  const frames = useMemo(
    () => withEditPreviews(canvas.frames, controls.previewViews),
    [canvas.frames, controls.previewViews],
  );
  // Inspection draws on every frame that the canvas shows.
  const shownViews = useMemo(
    () => framesViews(controls.previewViews, frames),
    [controls.previewViews, frames],
  );
  const instances = useWorkspaceInstanceSelection(data, views, inspectorRef);
  const inspection = useWorkspaceInspection({
    workspaceRef,
    highlightRef,
    comparisonActive: comparing,
    data,
    invalidSelection: Boolean(data.removed || variant?.removed),
    onSelect: instances.selectInstance,
    ...(instances.selectedKey ? { selectedKey: instances.selectedKey } : {}),
    views: shownViews,
  });
  const target = { kind: "entry" as const, entry };
  const head = targetHead(catalogue, target);
  const headStatus =
    data.component?.path === entry.path ? data.status : presentation.status;
  const preview = data.removed
    ? removedPreviewData(catalogue, context, entry)
    : undefined;
  const previous = usePreviousVersionLabel(preview, colorScheme);
  const stage = (
    <WorkspaceStage
      canvas={{
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
  const highlight = {
    available: inspection.available,
    active: inspection.highlighting,
    ...(inspection.reason ? { reason: inspection.reason } : {}),
    toggle: inspection.toggle,
  };

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
      overlay={inspection.overlay}
      panel={
        <RightPanel>
          <ScreenHead
            action={
              <WorkspaceControls
                changedViews={changedViews}
                dark={Boolean(context.embedded) && catalogue.hasDarkFragments}
                effectiveColorScheme={resolvedView.colorScheme}
                highlight={highlight}
                highlightRef={highlightRef}
              />
            }
            crumbs={head.crumbs}
            heading={head.title}
            path={head.path}
            status={
              <ChangeStatus mark="data-workspace-status" status={headStatus} />
            }
          />
          {data.comparisons && !preview ? (
            <ComparisonBand
              comparison={comparison}
              eligible={presentation.comparisonEligible}
            />
          ) : null}
          <WorkspaceVariantBar data={data} {...(variant ? { variant } : {})} />
          <WorkspaceInspector
            catalogue={catalogue}
            compared={comparison.loaded !== undefined}
            data={data}
            delivery={workspace.detailDelivery}
            inspectorRef={inspectorRef}
            instances={{
              activeViewport: instances.resolvedViewport,
              focus: (key, nextViewport) =>
                inspection.select(key, nextViewport, false),
              select: inspection.select,
              selectedKey: instances.selectedKey,
              setViewport: instances.setActiveViewport,
            }}
            previousPath={previousPath}
            props={
              <WorkspacePropsTab
                controls={controls.panel}
                data={data}
                delivery={workspace.detailDelivery}
                focus={propsRecovery}
                instance={instances.selectedInstance}
                target={editTarget}
                usage={instances.activeView?.usage}
              />
            }
            variantPath={variantPath}
            views={views}
          />
        </RightPanel>
      }
      previewRef={previewRef}
      preview={
        <FrameStageContext value={previewRef}>
          {preview ? (
            <RemovedPreviewStage data={preview} onShown={previous.onShown} />
          ) : data.comparisons ? (
            <ControlledDiffScreen
              compared={data.compared}
              comparison={comparison}
              entryId={variantPath ?? entry.path}
              entryKind={entry.kind}
              usingChanged={presentation.usingChanged}
            >
              {stage}
            </ControlledDiffScreen>
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
