/** User-facing copy and control contract for an unavailable previous version. */
export const PREVIEW_UNAVAILABLE = {
  body: "The previous version could not be loaded.",
  retry: {
    attribute: "data-mokly-preview-retry",
    label: "Retry",
  },
  title: "Previous version unavailable",
} as const;

/**
 * The previous version's other copy: the state while it loads, and the quiet
 * label of its section's head, whose Light-only form names a document that
 * keeps its light version under Dark.
 */
export const PREVIOUS_VERSION = {
  label: "Showing previous version",
  lightOnlyLabel: "Showing previous version — Light only",
  loading: "Loading previous version…",
} as const;
