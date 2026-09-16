import type { RenderCapability } from "../../packages/viewer/dist/components/render_types.js";

export type WatchedRenderCapability = RenderCapability & {
  readonly version: string;
};

/** Capture the controls authority and published version from one complete shell. */
export function settledRenderCapability(
  html: string,
): WatchedRenderCapability | undefined {
  if (!/data-changes-status="(?:ready|unavailable)"/.test(html))
    return undefined;
  const workspace = html.match(/data-workspace-data="">(.*?)<\/script>/s)?.[1];
  const version = html.match(/data-mokly-update-version="(\d+)"/)?.[1];
  if (!workspace || !version) return undefined;
  const data = JSON.parse(workspace) as {
    renderCapability?: RenderCapability;
    usageComplete?: boolean;
  };
  if (!data.renderCapability || data.usageComplete === false) return undefined;
  return { ...data.renderCapability, version };
}
