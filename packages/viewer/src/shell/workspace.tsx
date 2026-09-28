/** One bounded component/screen workspace with saved previews and an inspector. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { canonicalJson } from "../components/data.js";

import type { Catalogue } from "./catalogue.js";
import type { LoadedComparison } from "./comparison_request.js";
import { useComponentControls } from "./component_controls.js";
import type { ShellContext } from "./context.js";
import { DiffScreen } from "./diffs.js";
import { ScreenHead, targetHead } from "./head.js";
import { useInspectorResize } from "./inspector_resize.js";
import { LivePreviewFrameProvider, useLivePreview } from "./live_preview.js";
import { removedPreviewData, RemovedPreviewStage } from "./previews.js";
import { useOptionalShellStore } from "./store_context.js";
import type { ComparisonMode } from "./use_comparison.js";
import { useWorkspaceUsage } from "./use_workspace_usage.js";
import { useActiveWorkspace } from "./workspace_context.js";
import { WorkspaceControls } from "./workspace_controls.js";
import type { WorkspaceData } from "./workspace_data.js";
import { useWorkspaceInspection } from "./workspace_inspection.js";
import { WorkspaceInspector } from "./workspace_inspector.js";
import { staticWorkspaceEvidence } from "./workspace_privacy.js";
import { WorkspaceProps } from "./workspace_props.js";
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
  const store = useOptionalShellStore();
  const workspaceRef = useRef<HTMLElement>(null);
  const workspace = useActiveWorkspace();
  if (!workspace) throw new Error("The active workspace is unavailable.");
  const { data, refresh, request, selection, resolvedView, presentation } =
    workspace;
  const variant = selection.variant;
  const variantId = variant?.value.id;
  const changedViews = selectedChangedViews(
    entry,
    data.changedViews,
    variantId,
  );
  const viewport = store?.state.selection.viewport ?? "both";
  const colorScheme = store?.state.selection.colorScheme ?? "light";
  const savedViews = resolvedView.views;
  const [comparisonMode, setComparisonMode] =
    useState<ComparisonMode>("current");
  const [loadedComparison, setLoadedComparison] = useState<
    LoadedComparison | undefined
  >();
  const comparing = comparisonMode !== "current";
  const live = useLivePreview({ comparing, data, request, selection });
  const controls = useComponentControls({
    comparing,
    contexts: savedViews,
    data,
    livePreview: live.selected,
    request,
    variant,
    workspaceRef,
  });
  const views = useMemo(
    () =>
      visibleWorkspaceViews(
        { ...data, views: controls.previewViews },
        variantId,
        viewport,
        colorScheme,
      ),
    [colorScheme, controls.previewViews, data, variantId, viewport],
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
    setComparisonMode("current");
    setLoadedComparison(undefined);
    setActiveViewport(
      store?.state.route.viewport === "mobile" ? "mobile" : "desktop",
    );
    setSelectedKey(store?.state.route.instance);
  }, [entry.route, store?.state.route.instance, store?.state.route.viewport]);

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
    invalidSelection: Boolean(
      data.removed || selection.error || variant?.removed,
    ),
    liveActive: live.inspecting,
    onSelect: selectInstance,
    ...(selectedKey ? { selectedKey } : {}),
    views,
  });
  const target = { kind: "entry" as const, entry };
  const head = targetHead(catalogue, target);
  const preview = data.removed
    ? removedPreviewData(catalogue, context, entry)
    : undefined;
  const stage = (
    <LivePreviewFrameProvider value={live.frame}>
      <WorkspaceStage
        catalogue={catalogue}
        context={context}
        data={data}
        previewViews={controls.previewViews}
        target={target}
        variantRemoved={variant?.removed ?? false}
        {...(selection.error ? { error: selection.error } : {})}
        {...(variantId ? { variantId } : {})}
      />
    </LivePreviewFrameProvider>
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
            previewMode={live.control}
          />
        }
        crumbs={head.crumbs}
        heading={head.title}
        id={head.id}
        status={
          <span
            className="mbk-entry-status"
            data-status={presentation.status}
            data-workspace-status=""
            hidden={!presentation.status}
          >
            {presentation.status}
          </span>
        }
      />
      <WorkspaceVariantBar
        data={data}
        onSelect={(value) => store?.selectVariant(value)}
        {...(variant ? { variant } : {})}
      />
      <p
        className="mbk-selection-error"
        data-workspace-error=""
        hidden={!selection.error}
        role="status"
      >
        {selection.error}
      </p>
      <div className="mbk-workspace-panes">
        <div className="mbk-preview-pane" data-workspace-preview="">
          {preview ? (
            <RemovedPreviewStage data={preview} />
          ) : data.comparisons ? (
            <DiffScreen
              effectiveColorScheme={resolvedView.colorScheme}
              component={entry.kind === "component"}
              eligible={presentation.comparisonEligible}
              onComparisonChange={setLoadedComparison}
              onModeChange={setComparisonMode}
              route={entry.route}
              {...(variantId ? { variantId } : {})}
            >
              {stage}
            </DiffScreen>
          ) : (
            stage
          )}
        </div>
        <WorkspaceInspector
          activeViewport={resolvedViewport}
          catalogue={catalogue}
          components={showComponents}
          data={data}
          live={live.inspecting}
          loaded={loadedComparison?.result}
          onFocus={(key, nextViewport) =>
            inspection.select(key, nextViewport, false)
          }
          onSelect={inspection.select}
          onViewport={setActiveViewport}
          props={propsPanel}
          selectedKey={selectedKey}
          variantId={variantId}
          views={views}
        />
      </div>
      {inspection.overlay}
      <script
        data-workspace-data=""
        dangerouslySetInnerHTML={{
          __html: canonicalJson(staticWorkspaceEvidence(data)).replaceAll(
            "<",
            "\\u003c",
          ),
        }}
        type="application/json"
      />
    </section>
  );
}
