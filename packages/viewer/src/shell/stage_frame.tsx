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
import { useLivePreviewFrame } from "./live_preview.js";
import { LivePreviewFrame } from "./live_preview_frame.js";
import {
  frameSource,
  generatedFrameSource,
  generatedUsage,
  generatedView,
  unavailableUsage,
} from "./stage_sources.js";
import { useOptionalShellStore } from "./store_context.js";

/**
 * A selected, adapter-owned screen or component preview. While its workspace
 * selects Live, the same device chrome holds a Live frame instead; flow steps
 * always stay Static.
 */
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
  const workspaceLive = useLivePreviewFrame();
  const live = flow ? undefined : workspaceLive;
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
  const staticSource = live ? undefined : source;
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
    source: staticSource,
    usage: preview
      ? generatedUsage(preview)
      : (selected?.usage ?? unavailableUsage),
  });
  const initialSource = useFrameSource(
    mounted.frameRef,
    staticSource,
    registry?.baseUrl,
    temporary || Boolean(store?.interactive && registry),
  );
  const component = entry.kind === "component";
  const title = `${entry.title} — ${viewport}`;
  const frame = !source ? null : live ? (
    <LivePreviewFrame
      identity={identity}
      live={live}
      source={source}
      title={title}
      viewport={viewport}
    />
  ) : (
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
      title={title}
    />
  );
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
      {!live && mounted.status === "error" ? (
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
