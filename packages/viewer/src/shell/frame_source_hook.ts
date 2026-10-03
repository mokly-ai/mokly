/** Keep a React-owned frame source aligned after the hydration render. */

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { resolvedFrameSource } from "./stage_sources.js";

/** Keep the initial source stable; adapters own navigation once mounted. */
export function useFrameSource(
  frameRef: RefObject<HTMLIFrameElement | null>,
  source: string | undefined,
  baseUrl: string | URL | undefined,
  adapterOwned = false,
): string | undefined {
  const initial = useRef<string | undefined>(undefined);
  initial.current ??= resolvedFrameSource(source, baseUrl);
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
  }, [adapterOwned, baseUrl, frameRef, source]);
  return initial.current;
}
