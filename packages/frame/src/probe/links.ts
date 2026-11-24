import type { FrameNavigation } from "../frame_adapter.js";
import { frameLinkActivation } from "../navigation/activation.js";

import type { ProbeMetadata } from "./metadata.js";
const LINK = "data-mokly-frame-probe-link";
/** Cache accepted identities once, independently of the portable href or link text. */
export const probeNavigation =
  (metadata: ProbeMetadata) =>
  (event: MouseEvent): FrameNavigation | undefined => {
    const link = (event.target as Element | null)?.closest?.(`[${LINK}]`);
    if (
      !link ||
      link.ownerDocument !== event.currentTarget ||
      !(
        link instanceof HTMLAnchorElement ||
        link instanceof HTMLAreaElement ||
        link instanceof SVGAElement
      )
    )
      return;
    const activation = frameLinkActivation(
      event,
      link.hasAttribute("download"),
    );
    if (!activation) return;
    const index = link.getAttribute(LINK)!;
    const item = /^(0|[1-9]\d{0,3})$/.test(index)
      ? metadata.links[Number(index)]
      : undefined;
    return item
      ? {
          ...item,
          activation,
        }
      : undefined;
  };
