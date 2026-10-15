/** Lifetime checks for live temporary preview documents. */

import { useEffect, type RefObject } from "react";

import { localFramePath } from "../client/same_origin_adapter.js";
import type { ComponentRenderSuccess } from "../components/render_types.js";

import type { TemporaryPreviews } from "./data_context.js";

/** Report when a mounted temporary preview has been evicted by Serve. */
export function useComponentPreviewExpiration({
  onExpired,
  previews,
  temporaryPreviews,
  workspaceRef,
}: {
  onExpired(): void;
  previews: ReadonlyMap<string, ComponentRenderSuccess>;
  temporaryPreviews: TemporaryPreviews | undefined;
  workspaceRef: RefObject<HTMLElement | null>;
}): void {
  useEffect(() => {
    const root = workspaceRef.current;
    if (!root || !previews.size || !temporaryPreviews) return;
    const controller = new AbortController();
    const check = async (frame: HTMLIFrameElement) => {
      const preview = [...previews.values()].find(
        (result) => localFramePath(frame) === result.previewUrl,
      );
      if (!preview) return;
      try {
        const expired = await temporaryPreviews.expired(
          preview.previewUrl,
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
  }, [onExpired, previews, temporaryPreviews, workspaceRef]);
}
