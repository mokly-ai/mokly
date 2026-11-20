import { useEffect, useRef } from "react";

import type { Billing } from "../../api/types";
import {
  projectResourceScope,
  useInvalidateResources,
  workspaceResourceScope,
} from "../../data/resource-invalidation";

/**
 * Bring every other read of the plan up to date with one billing read. Each
 * read that reports Team invalidates the workspace and project resources, so
 * switching panes, closing settings, or the project screen beneath uses the
 * reconciled plan without a page reload. Every way a read arrives runs this
 * one rule: the pane's ordinary load, the read again on window focus in the
 * desktop app, and the bounded confirmation after Checkout.
 *
 * It runs once for each new read value, not for each render. The invalidation
 * hands the pane a new project object, so the identifiers are taken from refs
 * and do not restart the effect.
 */
export function useReconcilePlan(
  value: Billing | undefined,
  workspaceId: string,
  projectId: string | undefined,
): void {
  const invalidate = useInvalidateResources();
  const target = useRef({ invalidate, workspaceId, projectId });
  target.current = { invalidate, workspaceId, projectId };
  useEffect(() => {
    if (value?.plan !== "team") return;
    const now = target.current;
    now.invalidate([
      workspaceResourceScope(now.workspaceId),
      ...(now.projectId ? [projectResourceScope(now.projectId)] : []),
    ]);
  }, [value]);
}
