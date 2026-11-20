import { createContext, useContext } from "react";
import type { ReactNode } from "react";

/**
 * The host generation that currently owns one logical cloud slot. The slot
 * handoff reads it from the slot markup: only an activation that began in the
 * fallback generation can hold the ready transition, and a settled package
 * control stays package-owned for its whole activation, so the host never
 * renders the fallback again for it.
 */
export type ViewerSlotSource = "fallback" | "package";

const ViewerSlotSourceContext = createContext<ViewerSlotSource | undefined>(
  undefined,
);

/** Name the host generation rendering the cloud slots beneath this boundary. */
export function ViewerSlotSourceBoundary({
  children,
  source,
}: {
  children: ReactNode;
  source: ViewerSlotSource;
}) {
  return (
    <ViewerSlotSourceContext.Provider value={source}>
      {children}
    </ViewerSlotSourceContext.Provider>
  );
}

/** Read which host generation owns a logical cloud slot. */
export function useViewerSlotSource(): ViewerSlotSource | undefined {
  return useContext(ViewerSlotSourceContext);
}
