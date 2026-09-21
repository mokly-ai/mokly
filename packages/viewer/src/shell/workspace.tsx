/** One bounded component/screen workspace with saved previews and an inspector. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { canonicalJson } from "../components/data.js";

import type { Catalogue } from "./catalogue.js";
import type { LoadedComparison } from "./comparison_request.js";
import { useComponentControls } from "./component_controls.js";
import type { ShellContext } from "./context.js";
import { DiffScreen } from "./diffs.js";
import { ScreenHead, targetHead } from "./head.js";
import { Inspector } from "./inspector.js";
import { useInspectorResize } from "./inspector_resize.js";
import { useOptionalShellStore } from "./store_context.js";
import type { ComparisonMode } from "./use_comparison.js";
import { useWorkspaceData } from "./use_workspace_data.js";
import { useWorkspaceUsage } from "./use_workspace_usage.js";
import { WorkspaceControls } from "./workspace_controls.js";
import type { WorkspaceData } from "./workspace_data.js";
import { WorkspaceEvidence } from "./workspace_evidence.js";
import { useWorkspaceInspection } from "./workspace_inspection.js";
import { WorkspaceInstances } from "./workspace_instances.js";
import { WorkspaceProps } from "./workspace_props.js";
import { selectedVariantId } from "./workspace_selection.js";
import { WorkspaceStage } from "./workspace_stage.js";
import { WorkspaceUsage } from "./workspace_usage.js";
import { WorkspaceVariantBar } from "./workspace_variant_bar.js";
import { visibleWorkspaceViews } from "./workspace_views.js";

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
  const { data, refresh, request } = useWorkspaceData(
    catalogue,
    context,
    entry,
  );
  const selection = selectedVariantId(
    data,
    store?.state.route.variantValues ?? store?.state.route.variant,
  );
  const variant = selection.variant;
  const variantId = variant?.value.id;
  const viewport = store?.state.selection.viewport ?? "both";
  const colorScheme = store?.state.selection.colorScheme ?? "light";
  const savedViews = useMemo(
    () => visibleWorkspaceViews(data, variantId, viewport, colorScheme),
    [colorScheme, data.views, variantId, viewport],
  );
  const [comparisonMode, setComparisonMode] =
    useState<ComparisonMode>("current");
  const [loadedComparison, setLoadedComparison] = useState<
    LoadedComparison | undefined
  >();
  const comparing = comparisonMode !== "current";
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
    active: !comparing,
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
    invalidSelection: Boolean(selection.error || variant?.removed),
    onSelect: selectInstance,
    ...(selectedKey ? { selectedKey } : {}),
    views,
  });
  const target = { kind: "entry" as const, entry };
  const head = targetHead(catalogue, target);
  const stage = (
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
            dark={catalogue.hasDarkFragments}
            highlight={highlight}
          />
        }
        crumbs={head.crumbs}
        heading={head.title}
        id={head.id}
        status={
          <span
            className="mbk-entry-status"
            data-status={data.status}
            data-workspace-status=""
            hidden={!data.status}
          >
            {data.status}
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
          {data.comparisons ? (
            <DiffScreen
              component={entry.kind === "component"}
              eligible={selection.comparisonEligible}
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
                {...(loadedComparison
                  ? { loaded: loadedComparison.result }
                  : {})}
                {...(variantId ? { variantId } : {})}
              />
            ),
            props: propsPanel,
            usage: <WorkspaceUsage data={data} />,
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
