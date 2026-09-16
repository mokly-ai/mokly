import { FrameError } from "../client/frame_error.js";
import { frameUsage } from "../client/frame_usage.js";

import type { Session } from "./frame_session.js";
import { hasInstance, matchesInstance } from "./frame_views.js";
import { highlightKeys } from "./highlight_request.js";
import type { HighlightRequest } from "./highlight_request.js";
import type { InspectionWork } from "./inspection_work.js";

export interface InspectionScope {
  request: HighlightRequest;
  sessions: readonly Session[];
  keys: ReadonlyMap<Session, readonly string[]>;
}

/** Select once before readiness, masks, geometry or scrolling access a session. */
export function inspectionScope(
  sessions: readonly Session[],
  request: HighlightRequest,
): InspectionScope {
  const selected = sessions.filter(
    ({ frame }) =>
      request.kind === "workspace" || matchesInstance(frame, request.instance),
  );
  return {
    request,
    sessions: selected,
    keys: new Map(
      selected.map((session) => [
        session,
        highlightKeys(session.frame, request),
      ]),
    ),
  };
}

/** Retained sessions must still support every key owned before evidence adoption. */
export function validInspection(scope: InspectionScope): boolean {
  return scope.sessions.every((session) => {
    const usage = session.frame.view?.usage;
    return (
      usage?.status === "ready" &&
      !frameUsage(usage).error &&
      scope.keys.get(session)!.every((key) => hasInstance(usage, key))
    );
  });
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
