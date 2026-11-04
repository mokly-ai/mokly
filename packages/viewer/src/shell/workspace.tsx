/** One bounded component/screen workspace with saved previews and an inspector. */

import { useMemo, useRef } from "react";

import { ChangeStatus } from "@mokly/ui/change-status";
import type { InspectorHandle } from "@mokly/ui/inspector";
import { WorkspaceLayout } from "@mokly/ui/workspace-layout";

import type { Catalogue } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import { comparisonEligibilityKnown } from "./comparison_intent.js";
import { useComponentControls } from "./component_controls.js";
import type { ShellContext } from "./context.js";
import { controlTarget } from "./control_values.js";
import { ControlledDiffScreen } from "./diffs.js";
import { FrameStageContext } from "./frame_layout_context.js";
import { ScreenHead, targetHead } from "./head.js";
import { Inspector } from "./inspector.js";
import { useInspectorResize } from "./inspector_resize.js";
import { removedPreviewData, RemovedPreviewStage } from "./previews.js";
import { useShellStore } from "./store_context.js";
import { useComparison } from "./use_comparison.js";
import { useActiveWorkspace } from "./workspace_context.js";
import { WorkspaceControls } from "./workspace_controls.js";
import type { WorkspaceData } from "./workspace_data.js";
import { workspaceEvidenceEntry } from "./workspace_entry.js";
import { WorkspaceEvidence } from "./workspace_evidence.js";
import { useWorkspaceInspection } from "./workspace_inspection.js";
import { useWorkspaceInstanceSelection } from "./workspace_instance_selection.js";
import { WorkspaceInstances } from "./workspace_instances.js";
import { WorkspacePropsTab } from "./workspace_props.js";
import { WorkspaceStage } from "./workspace_stage.js";
import { WorkspaceUsage } from "./workspace_usage.js";
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
  const panesRef = useRef<HTMLDivElement>(null);
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
  const controls = useComponentControls({
    comparing,
    contexts: savedViews,
    data,
    onCurrent: () => comparison.selectMode("current"),
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
  const sizing = useInspectorResize(inspectorRef, panesRef, store.interactive);
  const {
    selectedInstance,
    selectedKey,
    resolvedViewport,
    activeView,
    setActiveViewport,
    selectInstance,
  } = useWorkspaceInstanceSelection(entry.path, views, inspectorRef);
  const inspection = useWorkspaceInspection({
    workspaceRef,
    highlightRef,
    comparisonActive: comparing,
    data,
    invalidSelection: Boolean(data.removed || variant?.removed),
    onSelect: selectInstance,
    ...(selectedKey ? { selectedKey } : {}),
    views,
  });
  const target = { kind: "entry" as const, entry };
  const head = targetHead(catalogue, target);
  const headStatus =
    data.component?.path === entry.path ? data.status : presentation.status;
  const preview = data.removed
    ? removedPreviewData(catalogue, context, entry)
    : undefined;
  const stage = (
    <WorkspaceStage
      catalogue={catalogue}
      context={context}
      data={data}
      previewViews={controls.previewViews}
      target={target}
      variantRemoved={variant?.removed ?? false}
      {...(variantPath ? { variantPath } : {})}
    />
  );
  const showComponents =
    entry.kind === "screen" ||
    views.some((view) => view.usage?.instances.length);
  const propsPanel = (
    <WorkspacePropsTab
      controls={controls.panel}
      data={data}
      delivery={workspace.detailDelivery}
      instance={selectedInstance}
      target={editTarget}
      usage={activeView?.usage}
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
      header={
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
      }
      inspector={
        <Inspector
          catalogue={catalogue}
          data={data}
          inspectorRef={inspectorRef}
          sizing={sizing}
          panels={{
            ...(showComponents
              ? {
                  components: (
                    <WorkspaceInstances
                      activeViewport={resolvedViewport}
                      data={data}
                      onFocus={(key, nextViewport) =>
                        inspection.select(key, nextViewport, false)
                      }
                      onSelect={inspection.select}
                      onViewport={setActiveViewport}
                      {...(selectedKey ? { selectedKey } : {})}
                      views={views}
                    />
                  ),
                }
              : {}),
            details: (
              <WorkspaceEvidence
                compared={comparison.loaded !== undefined}
                data={data}
                {...(previousPath ? { previousPath } : {})}
                {...(variantPath ? { variantPath } : {})}
              />
            ),
            props: propsPanel,
            usage: (
              <WorkspaceUsage data={data} delivery={workspace.detailDelivery} />
            ),
          }}
        />
      }
      overlay={inspection.overlay}
      panesRef={panesRef}
      previewRef={previewRef}
      preview={
        <FrameStageContext value={previewRef}>
          {preview ? (
            <RemovedPreviewStage data={preview} />
          ) : data.comparisons ? (
            <ControlledDiffScreen
              compared={data.compared}
              comparison={comparison}
              entryId={variantPath ?? entry.path}
              entryKind={entry.kind}
              eligible={presentation.comparisonEligible}
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
      variantBar={
        <WorkspaceVariantBar data={data} {...(variant ? { variant } : {})} />
      }
    />
  );
}
