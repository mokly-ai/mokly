import type { ComponentInstanceRecord } from "../components/manifest_types.js";
import type { WorkspaceData } from "../shell/workspace_data.js";

import { collapseFrame, expandedFrame } from "./browse_frames.js";
/** One disposable controller for the package's component and screen inspector. */
import {
  currentColorScheme,
  currentViewport,
  setColorScheme,
  setViewport,
} from "./browse_state.js";
import { ComponentControls } from "./component_controls.js";
import { installComponentHighlight } from "./component_highlight.js";
import type { LoadedDiff } from "./diff_views.js";
import { element, renderInstances, renderUsage } from "./inspector_panels.js";
import { installInspectorTabs } from "./inspector_tabs.js";
import { localInspection } from "./same_origin_adapter.js";
import { viewerServices } from "./services.js";
import { installWorkspaceEvents } from "./workspace_events.js";
import { renderWorkspaceEvidence } from "./workspace_evidence.js";
import {
  workspaceInstanceLabel,
  adapterHighlightUnavailable,
  configureHighlight,
} from "./workspace_inspection.js";
import type { WorkspaceInspection } from "./workspace_inspection.js";
import {
  workspaceViews,
  workspaceFrames,
  highlightUnavailable,
  renderViewContexts,
  revealWorkspaceInstance,
} from "./workspace_preview.js";
import { renderWorkspaceProps } from "./workspace_props.js";
import {
  mergeWorkspaceEvidence,
  updateWorkspaceEvidence,
} from "./workspace_updates.js";
import { applyVariant, selectedVariant } from "./workspace_variants.js";

export function installWorkspace(
  doc: Document,
  win: Window & typeof globalThis,
  updateDiffs: () => void,
  onHistoryChange: () => void,
  inspection?: WorkspaceInspection,
): () => void {
  const root = doc.querySelector<HTMLElement>("[data-workspace]");
  const json = root?.querySelector("[data-workspace-data]")?.textContent;
  if (!root || !json) return () => {};
  const data = JSON.parse(json) as WorkspaceData;
  const controller = new AbortController();
  const { signal } = controller;
  const query = new URLSearchParams(win.location.search);
  let variant = selectedVariant(data, win.location.search);
  let loaded: LoadedDiff | undefined;
  root.addEventListener(
    "mokly:workspace-evidence",
    (event) => {
      loaded = undefined;
      mergeWorkspaceEvidence(
        data,
        (event as CustomEvent<WorkspaceData>).detail,
      );
      variant = updateWorkspaceEvidence(root, data, win.location.search);
    },
    { signal },
  );
  let activeViewport: "mobile" | "desktop" =
    query.get("viewport") === "mobile" ? "mobile" : "desktop";
  let selected = query.get("instance") ?? undefined;
  const expanded = new Set<string>();
  let highlight = false;
  let stopHighlight: (() => void) | undefined;
  const toggle = root.querySelector<HTMLButtonElement>(
    "[data-workspace-highlight]",
  )!;
  const viewportControl = root.querySelector<HTMLSelectElement>(
    "[data-workspace-viewport]",
  )!;
  const schemeControl = root.querySelector<HTMLButtonElement>(
    "[data-workspace-scheme]",
  );
  const tabs = installInspectorTabs(root, signal, doc);
  const open = tabs.open;
  const panel = (name: string) =>
    root.querySelector<HTMLElement>(`[data-inspector-panel="${name}"]`);
  const comparison = () =>
    (root
      .querySelector('[data-diff-mode][aria-pressed="true"]')
      ?.getAttribute("data-diff-mode") ?? "current") !== "current";
  const controls =
    data.entry.kind === "component"
      ? new ComponentControls(root, data, signal, () => refresh())
      : undefined;
  const savedViews = () => workspaceViews(doc, data, variant.variant?.value.id);
  const currentViews = () => controls?.views(savedViews()) ?? savedViews();
  const current = () =>
    currentViews().find((view) => view.viewport === activeViewport) ??
    currentViews()[0];
  const currentInstance = (): ComponentInstanceRecord | undefined =>
    current()?.usage?.instances.find((item) => item.key === selected);
  const loadViews = (viewerServices(doc)?.workspaceLoader ?? (() => () => {}))(
    data,
    signal,
    () => {
      refresh();
      if (selected && currentInstance()) open("props", false);
    },
  );
  const select = (key: string, viewport = activeViewport) => {
    activeViewport = viewport;
    if (!current()?.usage?.instances.some((item) => item.key === key)) return;
    selected = key;
    collapseFrame(doc, expandedFrame(doc));
    if (!toggle.disabled) highlight = true;
    open("props");
    root
      .querySelector<HTMLElement>('[data-inspector-tab="props"]')
      ?.focus({ preventScroll: true });
    refresh();
    if (highlight)
      if (inspection) inspection.workspaceReveal(key, activeViewport);
      else revealWorkspaceInstance(root, activeViewport, current(), key);
  };
  const refresh = () => {
    stopHighlight?.();
    stopHighlight = undefined;
    controls?.sync(variant.variant, savedViews(), comparison());
    const views = currentViews();
    if (!comparison()) loadViews(savedViews());
    const view = current();
    activeViewport = view?.viewport ?? activeViewport;
    if (current()?.usage && !currentInstance()) selected = undefined;
    const selection = {
      ...(view?.usage ? { usage: view.usage } : {}),
      ...(currentInstance() ? { instance: currentInstance()! } : {}),
      ...(variant.variant
        ? {
            props: controls?.props() ?? variant.variant.value.props,
            slots: variant.variant.value.suppliedSlots,
          }
        : {}),
    };
    const components = panel("components");
    if (components) {
      renderInstances(
        components,
        data,
        selection,
        (key) => select(key),
        expanded,
        (key) => {
          selected = key;
          if (!toggle.disabled) highlight = true;
          refresh();
        },
      );
      renderViewContexts(components, views, activeViewport, (viewport) => {
        activeViewport = viewport;
        refresh();
      });
    }
    renderWorkspaceProps(panel("props")!, data, selection, controls, () => {
      selected = undefined;
      refresh();
    });
    renderWorkspaceEvidence(
      root.querySelector<HTMLElement>("[data-workspace-evidence]")!,
      data,
      variant.variant?.value.id,
      loaded?.result,
    );
    const frames = inspection ? [] : workspaceFrames(root, views);
    const activeFrame = frames.find(
      (frame) => frame.usage.viewport === activeViewport,
    );
    if (selected && activeFrame) {
      const inspection = localInspection(
        activeFrame.frame,
        activeFrame.path,
        activeFrame.usage,
      )!;
      if (!inspection.measure(new Set([selected])).length)
        panel("props")!.append(
          element(
            doc,
            "p",
            "This instance has no visible region in this view.",
          ),
        );
    }
    const reason = inspection
      ? adapterHighlightUnavailable(views, comparison())
      : highlightUnavailable(
          root,
          views,
          frames,
          Boolean(variant.error || data.removed || variant.variant?.removed),
        );
    highlight = configureHighlight(toggle, reason, highlight);
    if (highlight && !reason)
      stopHighlight = inspection
        ? inspection.workspaceHighlight(selected, select)
        : installComponentHighlight(
            root,
            frames,
            selected,
            (key) => workspaceInstanceLabel(data, views, key),
            select,
            () => {
              highlight = false;
              refresh();
              toggle.focus();
            },
          );
    viewportControl.value = currentViewport(doc);
    schemeControl?.setAttribute(
      "aria-pressed",
      String(currentColorScheme(doc) === "dark"),
    );
  };
  const activateVariant = () => {
    applyVariant(root, data, variant.variant, variant.error, {
      preservePreview: Boolean(inspection),
    });
    refresh();
    updateDiffs();
  };
  if (["mobile", "desktop", "both"].includes(query.get("viewport") ?? ""))
    setViewport(doc, query.get("viewport")!);
  if (query.get("scheme") === "light" || query.get("scheme") === "dark")
    setColorScheme(doc, query.get("scheme") as "light" | "dark");
  applyVariant(root, data, variant.variant, variant.error, {
    preservePreview: Boolean(inspection),
  });
  renderUsage(panel("usage")!, data);
  installWorkspaceEvents(
    root,
    win,
    signal,
    {
      refresh,
      comparison(comparisonDiff) {
        loaded = comparisonDiff;
        if (comparison()) highlight = false;
        refresh();
      },
      highlight() {
        highlight = !highlight;
        if (!highlight) selected = undefined;
        refresh();
      },
      scheme() {
        setColorScheme(
          doc,
          currentColorScheme(doc) === "dark" ? "light" : "dark",
        );
        refresh();
        updateDiffs();
      },
      viewport() {
        setViewport(doc, viewportControl.value);
        refresh();
        updateDiffs();
      },
      variant(value) {
        const url = new URL(win.location.href);
        url.searchParams.set("variant", value);
        url.searchParams.delete("instance");
        win.history.pushState({}, "", url);
        variant = selectedVariant(data, url.search);
        selected = undefined;
        expanded.clear();
        activateVariant();
        onHistoryChange();
      },
      escape(event) {
        if (highlight) {
          highlight = false;
          refresh();
          toggle.focus();
          event.preventDefault();
        } else if (tabs.active()) tabs.close();
      },
    },
    doc,
  );
  signal.addEventListener("abort", () => stopHighlight?.(), { once: true });
  refresh();
  if (currentInstance()) open("props");
  else if (tabs.preferredOpen ?? data.entry.kind === "component")
    open("details", false);
  if (query.get("comparison") === "side" && variant.comparisonEligible)
    root.querySelector<HTMLButtonElement>('[data-diff-mode="side"]')?.click();
  return () => controller.abort();
}
