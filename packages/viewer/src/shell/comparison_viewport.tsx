/**
 * The shared viewport one comparison chrome scrolls. This container attaches
 * the viewport and its spacer to the scroll controller;
 * `@mokly/ui/comparison-pane` draws them.
 */

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { ComparisonViewport as ComparisonViewportView } from "@mokly/ui/comparison-pane";

import type { ComparisonScrollSync } from "./comparison_scroll_types.js";

/** The scroll owner and viewport element a layer registers with. */
export interface ViewportScope {
  sync: ComparisonScrollSync;
  viewport: RefObject<HTMLDivElement | null>;
}

const ViewportContext = createContext<ViewportScope | undefined>(undefined);

/** The enclosing comparison viewport, if a layer is rendered inside one. */
export function useComparisonViewport(): ViewportScope | undefined {
  return useContext(ViewportContext);
}

/**
 * The only user-scrollable container of its layers. A sticky box the size of
 * the viewport holds the device-sized frames, so viewport units, fixed and
 * sticky content render as in Current; the spacer after it extends the range
 * to the section's largest document.
 */
export function ComparisonViewport({
  children,
  sync,
}: {
  children: ReactNode;
  sync: ComparisonScrollSync;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const scope = useMemo(() => ({ sync, viewport }), [sync]);
  useEffect(() => {
    if (!viewport.current || !spacer.current) return;
    return sync.attachViewport(viewport.current, spacer.current);
  }, [sync]);
  return (
    <ComparisonViewportView ref={viewport} spacerRef={spacer}>
      <ViewportContext.Provider value={scope}>
        {children}
      </ViewportContext.Provider>
    </ComparisonViewportView>
  );
}
