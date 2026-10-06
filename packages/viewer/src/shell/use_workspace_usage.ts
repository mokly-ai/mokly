/** On-demand component usage loading for the visible saved preview contexts. */

import { useEffect, useRef } from "react";

import type { ViewerCapabilityRequest } from "../client/host_capability_descriptor.js";

import { useViewerCapabilities } from "./capability_context.js";
import type { ShellGeneratedView } from "./usage_types.js";
import type { WorkspaceData } from "./workspace_data.js";

/** Retain one request cache while asking only for currently displayed views. */
export function useWorkspaceUsage({
  active,
  data,
  refresh,
  request,
  views,
}: {
  active: boolean;
  data: WorkspaceData;
  refresh(): void;
  request?: ViewerCapabilityRequest;
  views: readonly ShellGeneratedView[];
}): void {
  const capabilities = useViewerCapabilities();
  const loader = useRef<
    ((views: readonly ShellGeneratedView[]) => void) | undefined
  >(undefined);
  useEffect(() => {
    loader.current = undefined;
    if (!capabilities?.onDemand || !request) return;
    const controller = new AbortController();
    try {
      loader.current = capabilities.onDemand.loadWorkspace(
        request,
        data,
        controller.signal,
        refresh,
      );
    } catch {
      controller.abort();
      return;
    }
    return () => {
      loader.current = undefined;
      controller.abort();
    };
  }, [capabilities, data, refresh, request]);
  const viewKey = views
    .map(
      (view) =>
        `${view.variantPath ?? ""}/${view.viewport}/${view.colorScheme}/${view.path}`,
    )
    .join("|");
  useEffect(() => {
    if (active) loader.current?.(views);
  }, [active, viewKey, views]);
}
