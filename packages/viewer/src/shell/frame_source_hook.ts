/** Keep a React-owned frame source aligned after the hydration render. */

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { resolvedFrameSource } from "./stage_sources.js";

/** Preserve the server source initially, then apply route-driven source changes. */
export function useFrameSource(
  frameRef: RefObject<HTMLIFrameElement | null>,
  source: string | undefined,
  baseUrl: string | URL | undefined,
  temporary = false,
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
    if (temporary) return;
    const current = frame.getAttribute("src");
    const currentUrl = current
      ? new URL(current, frame.ownerDocument.baseURI).href
      : undefined;
    const nextUrl = new URL(resolved, frame.ownerDocument.baseURI).href;
    if (currentUrl !== nextUrl) frame.setAttribute("src", resolved);
  }, [baseUrl, frameRef, source, temporary]);
  return initial.current;
}
