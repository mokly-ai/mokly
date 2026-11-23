/**
 * The mount of a view's frame over the transport adapters: its source, its
 * identity in the shell's registry, and the documents of its view in each
 * scheme. A canvas frame of `canvas_live_frame.tsx` and a use case's step
 * frame of `canvas_use_case_frame.tsx` mount through it.
 */

import { useMemo } from "react";
import type { RefObject } from "react";

import { temporaryPreviewAdapter } from "@mokly/frame/internal";
import { VIEWER_DIRECTORY } from "@mokly/model";

import type {
  ShellCatalogueRoutedEntry,
  ShellCatalogueView,
} from "../catalogue/scoped_types.js";
import type { GeneratedComponentView } from "../components/views.js";

import {
  useMountedShellFrame,
  type FrameReadyListener,
} from "./frame_mount_hook.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameIdentity,
} from "./frame_registry.js";
import { useFrameGeneration, useFrameSource } from "./frame_source_hook.js";
import { useRetryContent } from "./retry_focus.js";
import {
  frameSource,
  generatedFrameSource,
  generatedUsage,
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
