/**
 * The settled copy of the Props tab's controls. The mockups render these
 * strings, and the viewer follows them. The last four have no artboard of
 * their own: a removed entry, a component without editable props, an entry
 * without props, and merged props that fail validation without one field to
 * highlight.
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
  invalidTogether: "These values are not valid together. Change one of them.",
} as const;
