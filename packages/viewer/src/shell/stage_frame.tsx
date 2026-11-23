/**
 * Live React frame chrome over the transport adapters. This container mounts
 * the frame and derives its sources; `@mokly/ui/preview-frame` draws the
 * frame, its label, and its error, and `@mokly/ui/device-frame` the phone.
 */

import { useContext, useMemo } from "react";
import type { RefObject } from "react";

import { temporaryPreviewAdapter } from "@mokly/frame/internal";
import { VIEWER_DIRECTORY } from "@mokly/model";
import { PhoneFrame } from "@mokly/ui/device-frame";
import { PreviewFrame, PreviewIframe } from "@mokly/ui/preview-frame";

import type {
  ShellCatalogueRoutedEntry,
  ShellCatalogueView,
} from "../catalogue/scoped_types.js";
import type { GeneratedComponentView } from "../components/views.js";
import { entryRoute } from "../navigation/routes.js";

import { DisplaySelection } from "./display_context.js";
import { FrameStageContext } from "./frame_layout_context.js";
import {
  useMountedShellFrame,
  type FrameReadyListener,
} from "./frame_mount_hook.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameIdentity,
} from "./frame_registry.js";
import { useFrameGeneration, useFrameSource } from "./frame_source_hook.js";
import { BrowserFrame } from "./frames.js";
import { focusThen, useRetryContent } from "./retry_focus.js";
import { schemeValue } from "./scheme_fallback.js";
import {
  frameSource,
  generatedFrameSource,
  generatedUsage,
  generatedView,
  shellFrameUsage,
  stageDocumentKey,
} from "./stage_sources.js";
import { useShellStore } from "./store_context.js";

/** A screen or a component, whose views stand in frames. */
type ViewEntry = Extract<
  ShellCatalogueRoutedEntry,
  { kind: "component" | "screen" }
>;

/** One frame of a view: what it shows and where it stands. */
export interface ViewFrameInput {
  entry: ViewEntry;
  /** Whether the frame's browser window covers the page. */
  expanded: boolean;
  fragment?: string | undefined;
  /** Hears once for each document that the frame mounts, when it is ready. */
  onReady?: FrameReadyListener | undefined;
  /** A live edit's render, which the frame shows in place of the view. */
  preview: GeneratedComponentView | undefined;
  /** The documents of the frame's view in each scheme, for its adapter. */
  sources: readonly string[];
  /** The stage that clips the frame. */
  stage: RefObject<HTMLDivElement | null> | undefined;
  stepIndex?: number | undefined;
  variantPath?: string | undefined;
  view: ShellCatalogueView | undefined;
  viewport: "desktop" | "mobile";
}

/**
 * Mount the frame of one view through its adapter: its source, its identity
 * in the shell's registry, and its document's state. A temporary render of
 * a live edit mounts through the temporary preview adapter.
 */
export function useViewFrame(input: ViewFrameInput) {
  const store = useShellStore();
  const registry = useOptionalShellFrameRegistry();
  const { entry, fragment, preview, stepIndex, variantPath, view, viewport } =
    input;
  const source = preview
    ? generatedFrameSource(preview, fragment, stepIndex)
    : frameSource(entry, view, fragment, stepIndex);
  const temporary =
    preview?.path.startsWith(`/${VIEWER_DIRECTORY}/components/renders/`) ??
    false;
  const previewAdapter = useMemo(temporaryPreviewAdapter, []);
  const identity = useMemo<ShellFrameIdentity>(
    () => ({
      entryPath: entry.path,
      viewport,
      ...(preview || view
        ? { colorScheme: preview?.colorScheme ?? view!.colorScheme }
        : {}),
      ...(stepIndex === undefined ? {} : { stepIndex }),
      ...(variantPath ? { variantPath } : {}),
    }),
    [entry.path, preview, view, stepIndex, variantPath, viewport],
  );
  const generation = useFrameGeneration(
    source,
    stageDocumentKey(view, preview),
  );
  const mounted = useMountedShellFrame({
    ...(temporary ? { adapter: previewAdapter } : {}),
    enabled: store.interactive,
    generation,
    identity,
    layout: { stage: input.stage, expanded: input.expanded },
    onReady: input.onReady,
    sources: input.sources,
    source,
    usage: preview ? generatedUsage(preview) : shellFrameUsage(view?.usage),
  });
  const initialSource = useFrameSource(
    mounted.frameRef,
    source,
    registry?.baseUrl,
    temporary || Boolean(store.interactive && registry),
    generation,
  );
  useRetryContent(mounted.frameRef);
  return { ...mounted, generation, initialSource, source };
}

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
  entry: ViewEntry;
  flow?: boolean;
  fragment?: string;
  hasDarkFragments: boolean;
  previewViews?: readonly GeneratedComponentView[];
  stepIndex?: number;
  variantPath?: string;
  views: readonly ShellCatalogueView[];
  viewport: "desktop" | "mobile";
}) {
  const stage = useContext(FrameStageContext);
  const selection = useContext(DisplaySelection);
  const store = useShellStore();
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
  const frameKey = frameIdentityKey({
    entryPath: entry.path,
    viewport,
    ...(stepIndex === undefined ? {} : { stepIndex }),
    ...(variantPath ? { variantPath } : {}),
  });
  const mounted = useViewFrame({
    entry,
    expanded: store.state.expandedFrame === frameKey,
    fragment,
    preview,
    sources: hasDarkFragments
      ? viewSources(
          entry,
          light,
          dark,
          previewLight,
          previewDark,
          fragment,
          stepIndex,
        )
      : [],
    stage,
    stepIndex,
    variantPath,
    view: selected,
    viewport,
  });
  const component = entry.kind === "component";
  const fallback = hasDarkFragments && !previewDark && !dark;
  const frame = mounted.source ? (
    <PreviewIframe
      busy={mounted.status === "loading"}
      data={{
        "data-mokly-fragment-frame": !flow || stepIndex === 0 ? "" : undefined,
        "data-mokly-frame-state": mounted.status,
        "data-workspace-frame": flow ? undefined : viewport,
      }}
      key={mounted.generation}
      ref={mounted.frameRef}
      src={mounted.initialSource}
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
      frameKey={frameKey}
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
      retry={{ onClick: focusThen(mounted.frameRef, mounted.retry) }}
      scheme={preview?.colorScheme ?? selected?.colorScheme ?? "light"}
    >
      {framed}
    </PreviewFrame>
  );
}

/**
 * The documents of one viewport's view in each scheme: a live edit's render
 * where one exists, else the saved view.
 */
export function viewSources(
  entry: ViewEntry,
  light: ShellCatalogueView | undefined,
  dark: ShellCatalogueView | undefined,
  previewLight: GeneratedComponentView | undefined,
  previewDark: GeneratedComponentView | undefined,
  fragment: string | undefined,
  stepIndex?: number,
): readonly string[] {
  return [
    previewLight
      ? generatedFrameSource(previewLight, fragment, stepIndex)
      : frameSource(entry, light, fragment, stepIndex),
    previewDark
      ? generatedFrameSource(previewDark, fragment, stepIndex)
      : frameSource(entry, dark, fragment, stepIndex),
  ].filter((value): value is string => value !== undefined);
}

function frameIdentityKey(identity: ShellFrameIdentity): string {
  return JSON.stringify([
    identity.entryPath,
    identity.variantPath,
    identity.stepIndex,
    identity.viewport,
  ]);
}
