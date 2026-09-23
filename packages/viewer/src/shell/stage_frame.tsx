/** Live React frame chrome over the transport adapters. */

import { useContext, useMemo } from "react";

import type {
  CatalogueRoutedEntry,
  CatalogueView,
} from "../catalogue/types.js";
import { temporaryPreviewAdapter } from "../client/same_origin_adapter.js";
import type { GeneratedComponentView } from "../components/views.js";
import { DisplaySelection } from "../viewer/display_context.js";

import { useMountedShellFrame } from "./frame_mount_hook.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameIdentity,
} from "./frame_registry.js";
import { useFrameSource } from "./frame_source_hook.js";
import { BrowserFrame, PhoneFrame } from "./frames.js";
import {
  framePath,
  frameSource,
  generatedFrameSource,
  generatedUsage,
  generatedView,
  unavailableUsage,
} from "./stage_sources.js";
import { useOptionalShellStore } from "./store_context.js";

/** A selected, adapter-owned screen or component preview. */
export function StageFrame({
  entry,
  flow = false,
  fragment,
  hasDarkFragments,
  previewViews,
  stepIndex,
  variantId,
  views,
  viewport,
}: {
  entry: CatalogueRoutedEntry;
  flow?: boolean;
  fragment?: string;
  hasDarkFragments: boolean;
  previewViews?: readonly GeneratedComponentView[];
  stepIndex?: number;
  variantId?: string;
  views: readonly CatalogueView[];
  viewport: "desktop" | "mobile";
}) {
  const selection = useContext(DisplaySelection);
  const store = useOptionalShellStore();
  const registry = useOptionalShellFrameRegistry();
  const light = views.find(
    (view) => view.viewport === viewport && view.colorScheme === "light",
  );
  const dark = views.find(
    (view) => view.viewport === viewport && view.colorScheme === "dark",
  );
  const previewLight = generatedView(
    previewViews,
    variantId,
    viewport,
    "light",
  );
  const previewDark = generatedView(previewViews, variantId, viewport, "dark");
  const selected = selection.colorScheme === "dark" ? (dark ?? light) : light;
  const preview =
    selection.colorScheme === "dark"
      ? (previewDark ?? previewLight)
      : previewLight;
  const source = preview
    ? generatedFrameSource(preview, fragment, stepIndex)
    : frameSource(selected, fragment, stepIndex);
  const temporary =
    preview?.path.startsWith("/__mokly/components/renders/") ?? false;
  const previewAdapter = useMemo(temporaryPreviewAdapter, []);
  const identity = useMemo<ShellFrameIdentity>(
    () => ({
      entryId: entry.id,
      route: entry.route,
      viewport,
      ...(preview || selected
        ? { colorScheme: preview?.colorScheme ?? selected!.colorScheme }
        : {}),
      ...(stepIndex === undefined ? {} : { stepIndex }),
      ...(variantId ? { variantId } : {}),
    }),
    [entry.id, entry.route, preview, selected, stepIndex, variantId, viewport],
  );
  const mounted = useMountedShellFrame({
    ...(temporary ? { adapter: previewAdapter } : {}),
    enabled: store?.interactive ?? false,
    identity,
    source,
    usage: preview
      ? generatedUsage(preview)
      : (selected?.usage ?? unavailableUsage),
  });
  const initialSource = useFrameSource(
    mounted.frameRef,
    source,
    registry?.baseUrl,
    temporary || Boolean(store?.interactive && registry),
  );
  const component = entry.kind === "component";
  const frame = source ? (
    <iframe
      aria-busy={mounted.status === "loading" ? true : undefined}
      className="mbk-frag"
      data-mokly-fragment-frame={!flow || stepIndex === 0 ? "" : undefined}
      data-mokly-frame-state={mounted.status}
      data-workspace-frame={flow ? undefined : viewport}
      data-fragment-light={
        hasDarkFragments
          ? previewLight
            ? generatedFrameSource(previewLight, fragment, stepIndex)
            : frameSource(light, fragment, stepIndex)
          : undefined
      }
      data-fragment-dark={
        hasDarkFragments
          ? previewDark
            ? generatedFrameSource(previewDark, fragment, stepIndex)
            : frameSource(dark, fragment, stepIndex)
          : undefined
      }
      ref={mounted.frameRef}
      sandbox="allow-same-origin"
      src={initialSource}
      title={`${entry.title} — ${viewport}`}
    />
  ) : null;
  const framed = component ? (
    frame
  ) : viewport === "mobile" ? (
    <PhoneFrame>{frame}</PhoneFrame>
  ) : (
    <BrowserFrame
      address={
        entry.kind === "screen" ? (entry.address ?? entry.route) : entry.route
      }
      frameKey={frameIdentityKey(identity)}
    >
      {frame}
    </BrowserFrame>
  );
  return (
    <div
      className={
        flow
          ? "mbk-flow-screen"
          : `${component ? "mbk-component-canvas" : "mbk-frame-wrap"} mbk-frame-${viewport}`
      }
      data-color-scheme-fallback={
        hasDarkFragments && !previewDark && !dark ? "" : undefined
      }
      data-preview-color-scheme={
        preview?.colorScheme ?? selected?.colorScheme ?? "light"
      }
    >
      {!flow ? (
        <FrameLabel
          fallback={hasDarkFragments && !previewDark && !dark}
          viewport={viewport}
        />
      ) : null}
      {framed ?? <p className="mbk-empty">This preview is unavailable.</p>}
      {mounted.status === "error" ? (
        <p className="mbk-frame-error" role="status">
          This preview could not be loaded.
        </p>
      ) : null}
    </div>
  );
}

/** A whole-document page with the same adapter-owned logical navigation. */
export function DocumentStageFrame({
  entry,
  fragment,
}: {
  entry: Extract<CatalogueRoutedEntry, { kind: "page" }>;
  fragment?: string;
}) {
  const store = useOptionalShellStore();
  const registry = useOptionalShellFrameRegistry();
  const source = entry.documentPath
    ? framePath(entry.documentPath, fragment)
    : undefined;
  const identity = useMemo<ShellFrameIdentity>(
    () => ({ entryId: entry.id, route: entry.route }),
    [entry.id, entry.route],
  );
  const mounted = useMountedShellFrame({
    enabled: store?.interactive ?? false,
    identity,
    source,
    usage: unavailableUsage,
  });
  const initialSource = useFrameSource(
    mounted.frameRef,
    source,
    registry?.baseUrl,
    Boolean(store?.interactive && registry),
  );
  return (
    <div
      className="mbk-stage-embed"
      data-mokly-scroll="embed"
      data-preview-color-scheme="light"
    >
      {source ? (
        <iframe
          aria-busy={mounted.status === "loading" ? true : undefined}
          className="mbk-frag"
          data-mokly-fragment-frame=""
          data-mokly-frame-state={mounted.status}
          ref={mounted.frameRef}
          sandbox="allow-same-origin"
          src={initialSource}
          title={entry.title}
        />
      ) : (
        <p className="mbk-empty">This preview is unavailable.</p>
      )}
      {mounted.status === "error" ? (
        <p className="mbk-frame-error" role="status">
          This preview could not be loaded.
        </p>
      ) : null}
    </div>
  );
}

function FrameLabel({
  fallback,
  viewport,
}: {
  fallback: boolean;
  viewport: "desktop" | "mobile";
}) {
  return (
    <p className="mbk-frame-label">
      {viewport === "mobile" ? "Mobile" : "Desktop"}
      {fallback ? (
        <span className="mbk-frame-scheme-note">{" — Light only"}</span>
      ) : null}
    </p>
  );
}

function frameIdentityKey(identity: ShellFrameIdentity): string {
  return JSON.stringify([
    identity.route,
    identity.variantId,
    identity.stepIndex,
    identity.viewport,
  ]);
}
