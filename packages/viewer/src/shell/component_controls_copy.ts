/**
 * The settled copy of the Props tab's controls. The design catalogue's
 * controls mockups render the same strings; a tooling test compares them.
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
} as const;
