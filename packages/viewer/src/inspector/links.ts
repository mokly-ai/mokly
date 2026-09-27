import type { FrameNavigation } from "../client/frame_adapter.js";

import type { InspectorMetadata } from "./metadata.js";
import { identity, object, shape } from "./values.js";

/** Narrow DOM event used by the browser-mounted `MockLink asChild` adapter. */
export const INTERACTIVE_NAVIGATION_EVENT = "mokly:interactive-navigation";
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
    if (!item) return;
    return {
      ...item,
      activation:
        event.type === "auxclick"
          ? "middle"
          : event.metaKey || event.ctrlKey || event.shiftKey
            ? "modified"
            : "primary",
    };
  };

/** Validate a browser-mounted logical identity before it enters the wire channel. */
export const inspectorInteractiveNavigation = (
  event: Event,
): FrameNavigation | undefined => {
  if (!(event instanceof CustomEvent)) return;
  const value: unknown = event.detail;
  if (
    !object(value) ||
    !shape(value, 2 + Number(Object.hasOwn(value, "fragment"))) ||
    !identity(value)
  )
    return;
  return { ...value, activation: "primary" } as FrameNavigation;
};
