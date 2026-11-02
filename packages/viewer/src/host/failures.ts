import {
  MoklyVersionError,
  VERSION_ERROR_MESSAGE,
} from "../catalogue/version_error.js";
import { ObsoleteInspection } from "../client/inspection_work.js";

import type { ViewerError, ViewerEvents } from "./types.js";

/** A detail the viewer could not load or accept; the entry offers a retry. */
export class EntryUnavailableError extends Error {
  constructor() {
    super("The entry detail could not be loaded.");
    this.name = "EntryUnavailableError";
  }
}

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
    const versionError = error instanceof MoklyVersionError ? error : undefined;
    const message = versionError
      ? VERSION_ERROR_MESSAGE
      : code === "selection"
        ? "The requested catalogue selection is unavailable."
        : code === "comparison"
          ? "The comparison could not be loaded. Try again."
          : code === "markers"
            ? "The requested markers could not be displayed."
            : error instanceof EntryUnavailableError
              ? "This entry could not be loaded. Try again."
              : code === "catalogue"
                ? "The catalogue changed. Reload it to see the new version."
                : "This instance is unavailable in the current view.";
    const failure = new Error(message);
    reported.set(error, failure);
    reported.set(failure, failure);
    if (active())
      events().onError?.({
        code: versionError ? "version" : code,
        message,
        ...(versionError ? { details: versionError.message } : {}),
      });
    return failure;
  };
}
