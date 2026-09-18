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
  complete: boolean;
}

/** Select once before readiness, masks, geometry or scrolling access a session. */
export function inspectionScope(
  sessions: readonly Session[],
  request: HighlightRequest,
): InspectionScope {
  const instances =
    request.kind === "instance"
      ? [request.instance]
      : request.kind === "instances"
        ? request.instances
        : undefined;
  const selected = sessions.filter(
    ({ frame }) =>
      instances === undefined ||
      instances.some((instance) => matchesInstance(frame, instance)),
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
    complete:
      instances === undefined ||
      instances.every((instance) =>
        selected.some((session) => matchesInstance(session.frame, instance)),
      ),
  };
}

/** Retained sessions must still support every key owned before evidence adoption. */
export function validInspection(scope: InspectionScope): boolean {
  return (
    scope.complete &&
    scope.sessions.every((session) => {
      const usage = session.frame.view?.usage;
      return (
        usage?.status === "ready" &&
        !frameUsage(usage).error &&
        scope.keys.get(session)!.every((key) => hasInstance(usage, key))
      );
    })
  );
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
