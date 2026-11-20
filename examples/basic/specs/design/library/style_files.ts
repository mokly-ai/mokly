/** Public stylesheets assigned to registered design-library components. */
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
  "canvas-frame": "design-library/canvas/canvas-frame.css",
  "zoom-pill": "design-library/canvas/zoom-pill.css",
  "floating-panel": "design-library/panels/floating-panel.css",
  "panel-tabs": "design-library/panels/panel-tabs.css",
  "phone-dock": "design-library/panels/phone-dock.css",
  "frames-filter": "design-library/inspector/frames-filter.css",
} as const;

export type LibraryStyle = keyof typeof libraryStyleFiles;
