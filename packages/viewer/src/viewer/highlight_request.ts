import { matchesInstance } from "./frame_views.js";
import type { ViewerFrame } from "./frame_views.js";
import type { InstanceRef } from "./types.js";

export type HighlightRequest =
  | { kind: "instance"; instance: InstanceRef }
  | { kind: "workspace"; key: string | undefined };

/** Public references select one frame; workspace keys intentionally span visible views. */
export function highlightKeys(
  frame: ViewerFrame,
  request: HighlightRequest,
): readonly string[] {
  if (request.kind === "instance")
    return matchesInstance(frame, request.instance)
      ? [request.instance.key]
      : [];
  return frame.view?.usage.status === "ready"
    ? frame.view.usage.instances
        .filter((instance) =>
          request.key
            ? instance.key === request.key
            : instance.owner.kind === "entry",
        )
        .map((instance) => instance.key)
    : [];
}
