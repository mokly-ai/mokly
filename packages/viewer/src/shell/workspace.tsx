/** One bounded component/screen workspace with saved previews and an inspector. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { canonicalJson } from "../components/data.js";

import type { Catalogue } from "./catalogue.js";
import { useComponentControls } from "./component_controls.js";
import type { ShellContext } from "./context.js";
import { ControlledDiffScreen } from "./diffs.js";
import { ScreenHead, targetHead } from "./head.js";
import { Inspector } from "./inspector.js";
import { useInspectorResize } from "./inspector_resize.js";
import { removedPreviewData, RemovedPreviewStage } from "./previews.js";
import { useOptionalShellStore } from "./store_context.js";
import { useComparison } from "./use_comparison.js";
import { useWorkspaceUsage } from "./use_workspace_usage.js";
import { useActiveWorkspace } from "./workspace_context.js";
import { WorkspaceControls } from "./workspace_controls.js";
import type { WorkspaceData } from "./workspace_data.js";
import { workspaceEvidenceEntry } from "./workspace_entry.js";
import { WorkspaceEvidence } from "./workspace_evidence.js";
import { useWorkspaceInspection } from "./workspace_inspection.js";
import { WorkspaceInstances } from "./workspace_instances.js";
import { WorkspaceProps } from "./workspace_props.js";
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
  const store = useOptionalShellStore();
  const workspaceRef = useRef<HTMLElement>(null);
  const workspace = useActiveWorkspace();
  if (!workspace) throw new Error("The active workspace is unavailable.");
  const { data, refresh, request, selection, resolvedView, presentation } =
    workspace;
  const variant = selection.variant;
  const variantPath = variant?.value.path;
  const changedViews = selectedChangedViews(
    workspaceEvidenceEntry(data),
    data.changedViews,
    variantPath,
  );
  const viewport = store?.state.selection.viewport ?? "both";
  const colorScheme = store?.state.selection.colorScheme ?? "light";
  const savedViews = resolvedView.views;
  const comparison = useComparison({
    effectiveColorScheme: resolvedView.colorScheme,
    eligible: Boolean(data.comparisons && presentation.comparisonEligible),
    entryId: variantPath ?? entry.path,
    ...(data.component ? { owner: data.component.path } : {}),
  });
  const comparing = comparison.mode !== "current";
  const controls = useComponentControls({
    comparing,
    contexts: savedViews,
    data,
    request,
    variant,
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
  const [activeViewport, setActiveViewport] = useState<"desktop" | "mobile">(
    viewport === "mobile" ? "mobile" : "desktop",
  );
  const [selectedKey, setSelectedKey] = useState<string | undefined>(
    store?.state.route.instance,
  );
  const openedInstance = useRef<string | undefined>(undefined);
  const resolvedViewport = views.some(
    (view) => view.viewport === activeViewport,
  )
    ? activeViewport
    : (views[0]?.viewport ?? activeViewport);
  const activeView =
    views.find((view) => view.viewport === resolvedViewport) ?? views[0];
  const selectedInstance = activeView?.usage?.instances.find(
    (instance) => instance.key === selectedKey,
  );

  useInspectorResize(workspaceRef, store?.interactive ?? false);
  useWorkspaceUsage({
    active: !comparing && !data.removed,
    data,
    refresh,
    ...(request ? { request } : {}),
    views: savedViews,
  });

  useEffect(() => {
    setActiveViewport(
      store?.state.route.viewport === "mobile" ? "mobile" : "desktop",
    );
    setSelectedKey(store?.state.route.instance);
  }, [entry.path, store?.state.route.instance, store?.state.route.viewport]);

  useEffect(() => {
    if (selectedKey && activeView?.usage && !selectedInstance)
      setSelectedKey(undefined);
  }, [activeView?.usage, selectedInstance, selectedKey]);

  useEffect(() => {
    if (!selectedInstance) {
      openedInstance.current = undefined;
      return;
    }
    if (openedInstance.current === selectedInstance.key) return;
    openedInstance.current = selectedInstance.key;
    store?.setDetails(true, "props");
  }, [selectedInstance, store]);

  const selectInstance = useCallback(
    (key: string, nextViewport: "desktop" | "mobile", openProps = true) => {
      openedInstance.current = key;
      setActiveViewport(nextViewport);
      setSelectedKey(key);
      if (!openProps) return;
      store?.setExpandedFrame(undefined);
      store?.setDetails(true, "props");
      queueMicrotask(() =>
        workspaceRef.current
          ?.querySelector<HTMLElement>('[data-inspector-tab="props"]')
          ?.focus({ preventScroll: true }),
      );
    },
    [store],
  );
  const inspection = useWorkspaceInspection({
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
    data.previewGeneration !== undefined ||
    entry.kind === "screen" ||
    views.some((view) => view.usage?.instances.length);
  const propsPanel = selectedInstance ? (
    <WorkspaceProps
      data={data}
      selection={{
        instance: selectedInstance,
        ...(activeView?.usage ? { usage: activeView.usage } : {}),
      }}
    />
  ) : entry.kind === "component" ? (
    controls.panel
  ) : (
    <WorkspaceProps data={data} selection={{}} />
  );
  const highlight = {
    available: inspection.available,
    active: inspection.highlighting,
    ...(inspection.reason ? { reason: inspection.reason } : {}),
    toggle: inspection.toggle,
  };

  return (
    <section className="mbk-workspace" data-workspace="" ref={workspaceRef}>
      <ScreenHead
        action={
          <WorkspaceControls
            changedViews={changedViews}
            dark={Boolean(context.embedded) && catalogue.hasDarkFragments}
            effectiveColorScheme={resolvedView.colorScheme}
            highlight={highlight}
          />
        }
        crumbs={head.crumbs}
        heading={head.title}
        id={head.id}
        status={
          <span
            className="mbk-entry-status"
            data-status={headStatus}
            data-workspace-status=""
            hidden={!headStatus}
          >
            {headStatus}
          </span>
        }
      />
      <WorkspaceVariantBar data={data} {...(variant ? { variant } : {})} />
      <div className="mbk-workspace-panes">
        <div className="mbk-preview-pane" data-workspace-preview="">
          {preview ? (
            <RemovedPreviewStage data={preview} />
          ) : data.comparisons ? (
            <ControlledDiffScreen
              comparison={comparison}
              entryId={variantPath ?? entry.path}
              entryKind={entry.kind}
              eligible={presentation.comparisonEligible}
            >
              {stage}
            </ControlledDiffScreen>
          ) : (
            stage
          )}
        </div>
        <Inspector
          catalogue={catalogue}
          data={data}
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
                data={data}
                {...(comparison.loaded
                  ? { loaded: comparison.loaded.result }
                  : {})}
                {...(variantPath ? { variantPath } : {})}
              />
            ),
            props: propsPanel,
            usage: (
              <WorkspaceUsage data={data} delivery={workspace.usageDelivery} />
            ),
          }}
        />
      </div>
      {inspection.overlay}
      <script
        data-workspace-data=""
        dangerouslySetInnerHTML={{
          __html: canonicalJson(data).replaceAll("<", "\\u003c"),
        }}
        type="application/json"
      />
    </section>
  );
}
