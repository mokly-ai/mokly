import type { ViewerCapabilityDescriptor } from "../../packages/viewer/dist/client/host_capability_descriptor.js";
import type { RenderCapability } from "../../packages/viewer/dist/components/render_types.js";

export type WatchedRenderCapability = RenderCapability & {
  readonly version: string;
};

/** Read the private controls authority from the live-host descriptor. */
export function renderCapabilityFromShell(
  html: string,
): RenderCapability | undefined {
  return hostCapabilityDescriptor(html)?.renderCapability;
}

/** Capture the controls authority and published version from one complete shell. */
export function settledRenderCapability(
  html: string,
): WatchedRenderCapability | undefined {
  if (!/data-changes-status="(?:ready|unavailable)"/.test(html))
    return undefined;
  const descriptor = hostCapabilityDescriptor(html);
  const version = html.match(/data-mokly-update-version="(\d+)"/)?.[1];
  if (
    !descriptor?.renderCapability ||
    !descriptor.workspace ||
    descriptor.workspace.usageComplete === false ||
    !version ||
    descriptor.source.updateVersion !== Number(version)
  )
    return undefined;
  return { ...descriptor.renderCapability, version };
}

function hostCapabilityDescriptor(
  html: string,
): ViewerCapabilityDescriptor | undefined {
  const state = html.match(
    /<script[^>]*data-mokly-host-capability-state=""[^>]*>([^<]+)<\/script>/,
  )?.[1];
  return state ? (JSON.parse(state) as ViewerCapabilityDescriptor) : undefined;
}
