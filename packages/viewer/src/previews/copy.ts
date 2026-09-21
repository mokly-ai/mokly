/** User-facing copy and control contract for an unavailable previous version. */
export const PREVIEW_UNAVAILABLE = {
  body: "The previous version could not be loaded.",
  retry: {
    attribute: "data-mokly-preview-retry",
    label: "Retry",
  },
  title: "Previous version unavailable",
} as const;
