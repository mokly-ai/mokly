/** Keep a React-owned frame source aligned with the shell's selection. */

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { resolvedFrameSource } from "./stage_sources.js";

/** The document one frame element shows, and how often it was replaced. */
export interface FrameGeneration {
  source: string | undefined;
  documentKey: string | undefined;
  generation: number;
}

/**
 * The generation of one frame element advances when the document the frame
 * shows keeps its source but its `documentKey` changes, so the shell replaces
 * only that frame's element and loads the new bytes. A source change, such as
 * a scheme swap, keeps the element and the adapter navigates it.
 */
export function nextFrameGeneration(
  current: FrameGeneration,
  source: string | undefined,
  documentKey: string | undefined,
): FrameGeneration {
  if (
    current.source === source &&
    current.documentKey !== undefined &&
    documentKey !== undefined &&
    current.documentKey !== documentKey
  )
    return { source, documentKey, generation: current.generation + 1 };
  if (current.source !== source || current.documentKey !== documentKey)
    return { ...current, source, documentKey };
  return current;
}

/** The element generation of one mounted frame; see `nextFrameGeneration`. */
export function useFrameGeneration(
  source: string | undefined,
  documentKey: string | undefined,
): number {
  const state = useRef<FrameGeneration>({ source, documentKey, generation: 0 });
  state.current = nextFrameGeneration(state.current, source, documentKey);
  return state.current.generation;
}

/** Keep the initial source stable; adapters own navigation once mounted. */
export function useFrameSource(
  frameRef: RefObject<HTMLIFrameElement | null>,
  source: string | undefined,
  baseUrl: string | URL | undefined,
  adapterOwned = false,
  generation = 0,
): string | undefined {
  const initial = useRef<{ generation: number; source: string | undefined }>(
    undefined,
  );
  if (initial.current?.generation !== generation)
    initial.current = {
      generation,
      source: resolvedFrameSource(source, baseUrl),
    };
  useEffect(() => {
    const frame = frameRef.current;
    const resolved = resolvedFrameSource(
      source,
      baseUrl ?? frame?.ownerDocument.baseURI,
    );
    if (!frame || !resolved) return;
    if (adapterOwned) return;
    const current = frame.getAttribute("src");
    const currentUrl = current
      ? new URL(current, frame.ownerDocument.baseURI).href
      : undefined;
    const nextUrl = new URL(resolved, frame.ownerDocument.baseURI).href;
    if (currentUrl !== nextUrl) frame.setAttribute("src", resolved);
  }, [adapterOwned, baseUrl, frameRef, source, generation]);
  return initial.current.source;
}
