/** One Live preview frame on the interactive origin, behind its preparing state. */

import { useEffect } from "react";

import type { CatalogueUsage } from "../catalogue/types.js";

import { useMountedShellFrame } from "./frame_mount_hook.js";
import type { ShellFrameIdentity } from "./frame_registry.js";
import { liveFrameSource } from "./live_frame_source.js";
import type { LivePreviewFrameOptions } from "./live_preview.js";
import { LIVE_PREVIEW_COPY } from "./preview_mode.js";
import { PreviewProgress } from "./preview_progress.js";
import { useOptionalShellStore } from "./store_context.js";

/** Live frames subscribe to navigation only; inspection stays on Static. */
const LIVE_USAGE: CatalogueUsage = { status: "pending" };

/**
 * Keep the preparing state over the frame until the view is known to be
 * eligible, its bundle is ready and its cross-origin adapter mount has
 * resolved, so neither a blank document nor an unconfirmed view shows.
 */
export function LivePreviewFrame({
  identity,
  live,
  source,
  title,
  viewport,
}: {
  identity: ShellFrameIdentity;
  live: LivePreviewFrameOptions;
  source: string;
  title: string;
  viewport: "desktop" | "mobile";
}) {
  const store = useOptionalShellStore();
  const liveSource = live.mountable
    ? liveFrameSource(source, live.frameOrigin)
    : undefined;
  const mounted = useMountedShellFrame({
    adapter: live.adapter,
    enabled: store?.interactive ?? false,
    identity,
    source: liveSource,
    usage: LIVE_USAGE,
  });
  const failed = mounted.status === "error" || (live.mountable && !liveSource);
  const ready = liveSource !== undefined && mounted.status === "ready";
  const report = live.unavailable;
  useEffect(() => {
    if (failed) report();
  }, [failed, report]);
  return (
    <div
      className="mbk-live-frame"
      data-live-frame-state={ready ? "ready" : "preparing"}
    >
      {liveSource ? (
        <iframe
          aria-busy={ready ? undefined : true}
          className="mbk-frag"
          data-mokly-frame-state={mounted.status}
          data-mokly-live-frame={viewport}
          ref={mounted.frameRef}
          sandbox="allow-same-origin allow-scripts"
          title={title}
        />
      ) : null}
      {ready ? null : (
        <PreviewProgress className="mbk-live-preparing">
          {LIVE_PREVIEW_COPY.preparing}
        </PreviewProgress>
      )}
    </div>
  );
}
