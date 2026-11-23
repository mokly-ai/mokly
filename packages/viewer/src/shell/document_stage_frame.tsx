/**
 * The frame of a whole-document page or Markdown document: its scheme and
 * its mount. This module mounts the frame and derives its sources; the
 * canvas's reading frame of `canvas_reading.tsx` shows it.
 */

import { useMemo } from "react";
import type { RefObject } from "react";

import { currentDocumentPath } from "@mokly/model";

import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";
import type { ViewerSelection } from "../host/types.js";
import { documentRoute } from "../navigation/routes.js";

import type { CanvasInputListener } from "./canvas_input.js";
import { useMountedShellFrame } from "./frame_mount_hook.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameIdentity,
} from "./frame_registry.js";
import { useFrameGeneration, useFrameSource } from "./frame_source_hook.js";
import { useRetryContent } from "./retry_focus.js";
import { schemeValue } from "./scheme_fallback.js";
import { framePath, unavailableUsage } from "./stage_sources.js";
import { useShellStore } from "./store_context.js";

/** A page or a Markdown document, whose one document stands in a frame. */
export type DocumentEntry = Extract<
  ShellCatalogueRoutedEntry,
  { kind: "page" | "document" }
>;

/**
 * The scheme of a document's shown render: the preview scheme, or Light
 * for a page and for a document without a dark render.
 */
export function documentScheme(
  entry: DocumentEntry,
  colorScheme: ViewerSelection["colorScheme"],
): "dark" | "light" {
  return schemeValue<"dark" | "light">(
    colorScheme,
    "light",
    entry.kind === "document" && entry.colorSchemes.includes("dark")
      ? "dark"
      : undefined,
  );
}

/**
 * Mount a document's frame through its adapter, with the same logical
 * navigation as a view's frame. A reading frame on the canvas passes
 * `onCanvasInput`, which receives its document's canvas input.
 */
export function useDocumentFrame(
  entry: DocumentEntry,
  scheme: "dark" | "light",
  fragment: string | undefined,
  stage: RefObject<HTMLDivElement | null> | undefined,
  onCanvasInput?: CanvasInputListener,
) {
  const store = useShellStore();
  const registry = useOptionalShellFrameRegistry();
  const source = framePath(
    currentDocumentPath(documentRoute(entry.path, scheme)),
    fragment,
  );
  const identity = useMemo<ShellFrameIdentity>(
    () => ({ entryPath: entry.path }),
    [entry.path],
  );
  const generation = useFrameGeneration(source, documentKeyOf(entry, scheme));
  const mounted = useMountedShellFrame({
    enabled: store.interactive,
    generation,
    identity,
    layout: { stage },
    onCanvasInput,
    sources:
      entry.kind === "document"
        ? entry.colorSchemes.map((colorScheme) =>
            framePath(
              currentDocumentPath(documentRoute(entry.path, colorScheme)),
              fragment,
            ),
          )
        : [],
    source,
    usage: unavailableUsage,
  });
  const initialSource = useFrameSource(
    mounted.frameRef,
    source,
    registry?.baseUrl,
    Boolean(store.interactive && registry),
    generation,
  );
  useRetryContent(mounted.frameRef);
  return { ...mounted, generation, initialSource, source };
}

/** The document key of a page, or of one scheme's render of a document. */
export function documentKeyOf(
  entry: DocumentEntry,
  scheme: "dark" | "light",
): string | undefined {
  return entry.kind === "page"
    ? entry.documentKey
    : entry.documentKeys.find((key) => key.colorScheme === scheme)?.documentKey;
}
