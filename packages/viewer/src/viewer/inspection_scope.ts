import { FrameError } from "../client/frame_error.js";

import type { Session } from "./frame_session.js";
import { matchesInstance } from "./frame_views.js";
import type { HighlightRequest } from "./highlight_request.js";
import type { InspectionWork } from "./inspection_work.js";

export interface InspectionScope {
  request: HighlightRequest;
  sessions: readonly Session[];
}

/** Select once before readiness, masks, geometry or scrolling access a session. */
export function inspectionScope(
  sessions: readonly Session[],
  request: HighlightRequest,
): InspectionScope {
  return {
    request,
    sessions: sessions.filter(
      ({ frame }) =>
        request.kind === "workspace" ||
        matchesInstance(frame, request.instance),
    ),
  };
}

export async function readyInspection(
  root: HTMLElement,
  sessions: readonly Session[],
  work: InspectionWork,
): Promise<void> {
  work.check();
  const mode = root
    .querySelector('[data-diff-mode][aria-pressed="true"]')
    ?.getAttribute("data-diff-mode");
  if (mode && mode !== "current")
    throw new Error("Choose Current to inspect this view.");
  if (!sessions.length) throw new FrameError("missing-instance");
  await work.run(() => Promise.all(sessions.map((session) => session.ready)));
}
