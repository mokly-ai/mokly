/** A number field's bounds: "0–24", "0 or more", "24 or less", or none. */
function bounds(minimum?: number, maximum?: number): string {
  if (minimum !== undefined && maximum !== undefined)
    return `${minimum}–${maximum}`;
  if (minimum !== undefined) return `${minimum} or more`;
  return maximum === undefined ? "" : `${maximum} or less`;
}

/** A step names itself unless it is 1, the step of every integer field. */
function steps(step?: number): string {
  return step === undefined || step === 1 ? "" : `in steps of ${step}`;
}

/**
 * The settled copy of the Props tab's controls. The design catalogue's
 * controls mockups use the same entries; a tooling test compares them.
 */
export const CONTROLS_COPY = {
  tab: "Props",
  heading: "Edit props",
  readonlyHeading: "Saved props",
  saved: "Saved props",
  edited: "Edited props",
  reset: (title: string) => `Reset to ${title}`,
  restored: "Saved props restored.",
  updating: "Updating preview…",
  preparing: "Preparing to edit props…",
  preparingFailed: "Editing could not start.",
  comparison: "Comparisons show the saved props.",
  switchToCurrent: "Switch to Current",
  published: "Open this catalogue locally to edit props.",
  failedTitle: "The preview could not be updated",
  failedBody: "Your edits are kept. The preview shows the last valid props.",
  retry: "Try again",
  invalid:
    "Check the highlighted values. The preview shows the last valid props.",
  removed: "Removed entries show their saved props.",
  readonlyProps: "These props are read-only.",
  noProps: "This entry renders without props.",
  invalidTogether: "These values are not valid together.",
  expiredTitle: "The preview of your edits expired",
  expiredBody: "Your edits are kept. The preview shows the saved props.",
  expiredAction: "Update preview",
  optional: "Optional",
  set: (name: string) => `Set ${name}`,
  notSet: "Not set",
  /** A number field's help; a field without bounds or a step has none. */
  range: (minimum?: number, maximum?: number, step?: number) => {
    const span = bounds(minimum, maximum);
    const every = steps(step);
    if (!every) return span;
    return span ? `${span} ${every}` : `In steps of ${step}`;
  },
  numberError: (minimum?: number, maximum?: number, step?: number) => {
    const every = steps(step);
    const tail = every ? ` ${every}` : "";
    if (minimum !== undefined && maximum !== undefined)
      return `Enter a number from ${minimum} to ${maximum}${tail}.`;
    if (minimum !== undefined)
      return `Enter a number of ${minimum} or more${tail}.`;
    if (maximum !== undefined)
      return `Enter a number of ${maximum} or less${tail}.`;
    return `Enter a number${tail}.`;
  },
} as const;
