/** Ordered candidates; each render emits only the component sheets it requests. */
export const libraryStyleFiles = {
  "top-bar": "design-library/chrome/top-bar.css",
  "catalogue-navigation": "design-library/chrome/catalogue-navigation.css",
  "screen-header": "design-library/chrome/screen-header.css",
  "appearance-selector": "design-library/chrome/appearance-selector.css",
  "comparison-toolbar": "design-library/controls/comparison-toolbar.css",
  "view-controls": "design-library/controls/view-controls.css",
  "tag-picker": "design-library/controls/tag-picker.css",
  "tag-chip": "design-library/controls/tag-chip.css",
  "change-status": "design-library/controls/change-status.css",
  inspector: "design-library/inspector/inspector.css",
  "metadata-row": "design-library/inspector/metadata-row.css",
  "prop-field": "design-library/inspector/prop-field.css",
  "device-frame": "design-library/preview/device-frame.css",
  "comparison-pane": "design-library/preview/comparison-pane.css",
  "empty-state": "design-library/preview/empty-state.css",
  "flow-step": "design-library/preview/flow-step.css",
} as const;

export type LibraryStyle = keyof typeof libraryStyleFiles;
export const libraryStyleCandidates = Object.values(libraryStyleFiles);

export function withLibraryStyles(
  base: readonly string[],
  layout: readonly string[] = [],
): string[] {
  return [...base, ...libraryStyleCandidates, ...layout];
}
