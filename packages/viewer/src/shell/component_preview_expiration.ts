/** Lifetime checks for live temporary component preview documents. */

import { useEffect, type RefObject } from "react";

import type { ViewerHostCapabilities } from "../client/host_capabilities.js";
import type { ViewerCapabilityRequest } from "../client/host_capability_descriptor.js";
import type { ComponentRenderSuccess } from "../components/render_types.js";

/** Report when a mounted temporary preview has been evicted by the host. */
export function useComponentPreviewExpiration({
  capabilities,
  onExpired,
  previews,
  request,
  workspaceRef,
}: {
  capabilities: ViewerHostCapabilities | undefined;
  onExpired(): void;
  previews: ReadonlyMap<string, ComponentRenderSuccess>;
  request: ViewerCapabilityRequest | undefined;
  workspaceRef: RefObject<HTMLElement | null>;
}): void {
  useEffect(() => {
    const root = workspaceRef.current;
    if (!root || !request || !previews.size || !capabilities?.temporaryPreviews)
      return;
    const controller = new AbortController();
    const check = async (frame: HTMLIFrameElement) => {
      try {
        const expired = await capabilities.temporaryPreviews!.expired(
          request,
          frame,
          previews.values(),
          controller.signal,
        );
        if (!controller.signal.aborted && expired) onExpired();
      } catch {
        return;
      }
    };
    const frames = [
      ...root.querySelectorAll<HTMLIFrameElement>(
        "iframe[data-workspace-frame]",
      ),
    ];
    const listeners = frames.map((frame) => {
      const listener = () => void check(frame);
      frame.addEventListener("load", listener);
      return { frame, listener };
    });
    return () => {
      controller.abort();
      for (const { frame, listener } of listeners)
        frame.removeEventListener("load", listener);
    };
  }, [capabilities, onExpired, previews, request, workspaceRef]);
}
