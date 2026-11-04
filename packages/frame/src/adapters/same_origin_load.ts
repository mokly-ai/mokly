/** Decide navigation ownership before considering inspection readiness. */

import { recordedFrameResource } from "./same_origin_access.js";
import {
  assignedFrameResource,
  sameFrameResource,
  type MountAuthentication,
} from "./same_origin_identity.js";

/** Reuse only accepted documents and never await a superseded assignment. */
export function initialFrameLoad(
  frame: HTMLIFrameElement,
  current: Document | null,
  expected: URL,
  authentication: MountAuthentication,
): "adopt" | "replace" | "wait" {
  const previous = authentication.previousResource;
  if (
    previous === undefined
      ? !assignedFrameResource(frame, expected)
      : !sameFrameResource(previous, expected)
  )
    return "replace";

  const accepted = authentication.authenticateAssignedDocument(
    current,
    expected,
  );
  if (accepted) return accepted.readyState === "complete" ? "adopt" : "wait";

  if (
    previous === undefined &&
    (!current ||
      current.URL === "about:blank" ||
      recordedFrameResource(frame, current.URL))
  )
    return "wait";

  return "replace";
}
