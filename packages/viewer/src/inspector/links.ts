import type { FrameNavigation } from "../client/frame_adapter.js";

import type { InspectorMetadata } from "./metadata.js";
/** Cache accepted identities once, independently of the portable href or link text. */
export const inspectorNavigation =
  (metadata: InspectorMetadata) =>
  (event: MouseEvent): FrameNavigation | undefined => {
    const link = (event.target as Element | null)?.closest?.(
      "[data-mokly-inspector-link]",
    );
    if (
      !link ||
      link.ownerDocument !== event.currentTarget ||
      link.hasAttribute("download") ||
      event.altKey ||
      (event.type === "click" ? event.button !== 0 : event.button !== 1) ||
      !(
        link instanceof HTMLAnchorElement ||
        link instanceof HTMLAreaElement ||
        link instanceof SVGAElement
      )
    )
      return;
    const index = link.getAttribute("data-mokly-inspector-link")!;
    const item = /^(0|[1-9]\d{0,3})$/.test(index)
      ? metadata.links[Number(index)]
      : undefined;
    return item
      ? {
          ...item,
          activation:
            event.type === "auxclick"
              ? "middle"
              : event.metaKey || event.ctrlKey || event.shiftKey
                ? "modified"
                : "primary",
        }
      : undefined;
  };
