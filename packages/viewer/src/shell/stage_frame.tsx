/**
 * Live React frame chrome over the transport adapters. This container mounts
 * the frame and derives its sources; `@mokly/ui/preview-frame` draws the
 * frame, its label, and its error, and `@mokly/ui/device-frame` the phone.
 */

import { useContext, useMemo } from "react";

import { PhoneFrame } from "@mokly/ui/device-frame";
import { PreviewFrame, PreviewIframe } from "@mokly/ui/preview-frame";

import { VIEWER_DIRECTORY } from "../catalogue/delivery_paths.js";
import type {
  ShellCatalogueRoutedEntry,
  ShellCatalogueView,
} from "../catalogue/scoped_types.js";
import { temporaryPreviewAdapter } from "../client/same_origin_adapter.js";
import type { GeneratedComponentView } from "../components/views.js";
import { entryRoute } from "../navigation/routes.js";

import { DisplaySelection } from "./display_context.js";
import { useMountedShellFrame } from "./frame_mount_hook.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameIdentity,
} from "./frame_registry.js";
import { useFrameGeneration, useFrameSource } from "./frame_source_hook.js";
import { BrowserFrame } from "./frames.js";
import { schemeValue } from "./scheme_fallback.js";
import {
  frameSource,
  generatedFrameSource,
  generatedUsage,
  generatedView,
  shellFrameUsage,
  stageDocumentKey,
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
  variantPath,
  views,
  viewport,
}: {
  entry: Extract<ShellCatalogueRoutedEntry, { kind: "component" | "screen" }>;
  flow?: boolean;
  fragment?: string;
  hasDarkFragments: boolean;
  previewViews?: readonly GeneratedComponentView[];
  stepIndex?: number;
  variantPath?: string;
  views: readonly ShellCatalogueView[];
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
    variantPath,
    viewport,
    "light",
  );
  const previewDark = generatedView(
    previewViews,
    variantPath,
    viewport,
    "dark",
  );
  const selected = schemeValue(selection.colorScheme, light, dark);
  const preview = schemeValue(selection.colorScheme, previewLight, previewDark);
  const source = preview
    ? generatedFrameSource(preview, fragment, stepIndex)
    : frameSource(entry, selected, fragment, stepIndex);
  const temporary =
    preview?.path.startsWith(`/${VIEWER_DIRECTORY}/components/renders/`) ??
    false;
  const previewAdapter = useMemo(temporaryPreviewAdapter, []);
  const identity = useMemo<ShellFrameIdentity>(
    () => ({
      entryPath: entry.path,
      viewport,
      ...(preview || selected
        ? { colorScheme: preview?.colorScheme ?? selected!.colorScheme }
        : {}),
      ...(stepIndex === undefined ? {} : { stepIndex }),
      ...(variantPath ? { variantPath } : {}),
    }),
    [entry.path, preview, selected, stepIndex, variantPath, viewport],
  );
  const generation = useFrameGeneration(
    source,
    stageDocumentKey(selected, preview),
  );
  const mounted = useMountedShellFrame({
    ...(temporary ? { adapter: previewAdapter } : {}),
    enabled: store?.interactive ?? false,
    generation,
    identity,
    source,
    usage: preview ? generatedUsage(preview) : shellFrameUsage(selected?.usage),
  });
  const initialSource = useFrameSource(
    mounted.frameRef,
    source,
    registry?.baseUrl,
    temporary || Boolean(store?.interactive && registry),
    generation,
  );
  const component = entry.kind === "component";
  const fallback = hasDarkFragments && !previewDark && !dark;
  const frame = source ? (
    <PreviewIframe
      busy={mounted.status === "loading"}
      data={{
        "data-mokly-fragment-frame": !flow || stepIndex === 0 ? "" : undefined,
        "data-mokly-frame-state": mounted.status,
        "data-workspace-frame": flow ? undefined : viewport,
        "data-fragment-light": hasDarkFragments
          ? previewLight
            ? generatedFrameSource(previewLight, fragment, stepIndex)
            : frameSource(entry, light, fragment, stepIndex)
          : undefined,
        "data-fragment-dark": hasDarkFragments
          ? previewDark
            ? generatedFrameSource(previewDark, fragment, stepIndex)
            : frameSource(entry, dark, fragment, stepIndex)
          : undefined,
      }}
      key={generation}
      ref={mounted.frameRef}
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
      address={entry.address ?? entryRoute(entry.path)}
      frameKey={frameIdentityKey(identity)}
    >
      {frame}
    </BrowserFrame>
  );
  return (
    <PreviewFrame
      error={mounted.status === "error"}
      fallback={fallback}
      placement={
        flow
          ? { kind: "flow" }
          : { kind: component ? "canvas" : "frame", viewport }
      }
      scheme={preview?.colorScheme ?? selected?.colorScheme ?? "light"}
    >
      {framed}
    </PreviewFrame>
  );
}

function frameIdentityKey(identity: ShellFrameIdentity): string {
  return JSON.stringify([
    identity.entryPath,
    identity.variantPath,
    identity.stepIndex,
    identity.viewport,
  ]);
}
