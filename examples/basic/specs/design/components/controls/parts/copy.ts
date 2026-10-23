/**
 * A number field's bounds: "0–24", "0 or more", "24 or less", or none. A
 * negative bound reads "-10 to -1", because a dash beside a minus misleads.
 */
function bounds(minimum?: number, maximum?: number): string {
  if (minimum !== undefined && maximum !== undefined)
    return minimum < 0 || maximum < 0
      ? `${minimum} to ${maximum}`
      : `${minimum}–${maximum}`;
  if (minimum !== undefined) return `${minimum} or more`;
  return maximum === undefined ? "" : `${maximum} or less`;
}

/** A step names itself unless it is 1, the step of every integer field. */
function steps(step?: number): string {
  return step === undefined || step === 1 ? "" : `in steps of ${step}`;
}

/** A count of characters: "1 character", "5 characters". */
function characters(count: number): string {
  return `${count} character${count === 1 ? "" : "s"}`;
}

/**
 * The settled copy of the Props tab's controls; the viewer follows it, and a
 * tooling test compares the two. The mockups draw the entries of the states
 * they show. The field functions also give the forms that no mockup draws:
 * one-sided bounds, steps, whole numbers, and text lengths. The Read-only
 * and recovery gallery draws the removed entry, read-only props, an entry
 * without props, merged props that fail without one field to highlight, and
 * an expired preview. The component Loading and recovery gallery draws the
 * tab while the entry's detail loads and after its load failed.
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
  loading: "Loading props…",
  loadFailed: "Props couldn’t be loaded.",
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
  /** A value inside the range of a step-1 field that is not whole. */
  wholeNumberError: (minimum?: number, maximum?: number) => {
    if (minimum !== undefined && maximum !== undefined)
      return `Enter a whole number from ${minimum} to ${maximum}.`;
    if (minimum !== undefined)
      return `Enter a whole number of ${minimum} or more.`;
    if (maximum !== undefined)
      return `Enter a whole number of ${maximum} or less.`;
    return "Enter a whole number.";
  },
  /** A text field's error names its length; no minimum below 1 counts. */
  textError: (minimum?: number, maximum?: number) => {
    const shortest = minimum !== undefined && minimum > 0 ? minimum : undefined;
    if (shortest !== undefined && maximum !== undefined)
      return shortest === maximum
        ? `Enter ${characters(maximum)}.`
        : `Enter ${shortest} to ${characters(maximum)}.`;
    if (maximum !== undefined) return `Enter up to ${characters(maximum)}.`;
    if (shortest !== undefined)
      return `Enter at least ${characters(shortest)}.`;
    return "Enter an allowed value.";
  },
  chooseValue: "Choose a value",
  chooseAvailable: "Choose an available value.",
  propsUnavailable: "Props are unavailable for this screen.",
} as const;
