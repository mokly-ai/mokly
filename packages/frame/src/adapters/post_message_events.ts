import type { FrameEvent } from "../frame_adapter.js";
import type { ProbeMetadata } from "../probe/metadata.js";
import type { Message } from "../probe/schema.js";

import { knownKey } from "./frame_usage.js";

export function forwardPostMessageEvent(
  message: Message,
  usage: ProbeMetadata,
  notify: (event: FrameEvent) => void,
): void {
  if (message.type === "hover" || message.type === "click") {
    if (message.key !== null && !knownKey(usage, message.key)) {
      notify({ type: "error", code: "invalid-message" });
      return;
    }
    notify(
      message.type === "click"
        ? { type: "click", key: message.key, boxes: message.boxes }
        : { type: "hover", key: message.key, boxes: message.boxes },
    );
  } else if (message.type === "geometry") notify({ type: "geometry" });
  else if (message.type === "pick-end")
    notify({ type: "pick-end", reason: message.reason });
  else if (message.type === "navigation")
    notify({ type: "navigation", navigation: message.navigation });
  else if (message.type === "canvas-wheel")
    notify({
      type: message.type,
      deltaY: message.deltaY,
      deltaMode: message.deltaMode,
      x: message.x,
      y: message.y,
    });
  else if (message.type === "canvas-pinch")
    notify({
      type: message.type,
      scale: message.scale,
      x: message.x,
      y: message.y,
    });
  else if (message.type === "canvas-key")
    notify({ type: message.type, key: message.key });
  else if (message.type === "canvas-focus")
    notify({ type: message.type, visible: message.visible });
  else if (message.type === "canvas-blur") notify({ type: message.type });
}
