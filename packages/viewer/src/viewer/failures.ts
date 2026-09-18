import { ObsoleteInspection } from "./inspection_work.js";
import type { ViewerError, ViewerEvents } from "./types.js";

/** Report an operation once, even when a mount and its waiting handle both fail. */
export function viewerFailures(
  events: () => ViewerEvents,
  active: () => boolean,
) {
  const reported = new Map<unknown, Error>();
  return (error: unknown, code: ViewerError["code"]): Error => {
    if (error instanceof ObsoleteInspection) return error;
    const previous = reported.get(error);
    if (previous) return previous;
    const message =
      code === "selection"
        ? "The requested catalogue selection is unavailable."
        : code === "comparison"
          ? "The comparison could not be loaded. Try again."
          : code === "markers"
            ? "The requested markers could not be displayed."
            : "This instance is unavailable in the current view.";
    const failure = new Error(message);
    reported.set(error, failure);
    reported.set(failure, failure);
    if (active()) events().onError?.({ code, message });
    return failure;
  };
}
