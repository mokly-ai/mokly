/** The Static/Live presence a newly routed view keeps while its eligibility loads. */

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * Whether the view the shell last displayed offered Static/Live. Effects write
 * it after each commit; a routed view reads it only while its eligibility is
 * pending, so the control neither disappears nor appears ahead of evidence.
 */
export interface LivePreviewRetention {
  offered: boolean;
}

const LivePreviewRetentionContext = createContext<
  LivePreviewRetention | undefined
>(undefined);

/** One retention slot per shell root, above the route-keyed workspace. */
export function LivePreviewRetentionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [retention] = useState<LivePreviewRetention>(() => ({
    offered: false,
  }));
  return (
    <LivePreviewRetentionContext value={retention}>
      {children}
    </LivePreviewRetentionContext>
  );
}

/** The shell root's retention slot; hosts without one retain nothing. */
export function useLivePreviewRetention(): LivePreviewRetention | undefined {
  return useContext(LivePreviewRetentionContext);
}

/**
 * Record the presence this view displays after it commits. A workspace that
 * unmounts without a routed successor, such as navigation to a page, a flow
 * or home, leaves no control on screen, so its cleanup records `false`; a
 * routed successor has already read the value and records its own.
 */
export function useRecordLivePreviewPresence(
  retention: LivePreviewRetention | undefined,
  offered: boolean,
): void {
  useEffect(() => {
    if (!retention) return;
    retention.offered = offered;
    return () => {
      retention.offered = false;
    };
  }, [offered, retention]);
}
