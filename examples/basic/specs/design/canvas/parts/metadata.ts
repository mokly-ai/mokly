/** Shared authored evidence for the Canvas viewer design screens. */
export const canvasDesignMetadata = {
  colorSchemes: ["light", "dark"],
  relatedDocs: [
    "docs/protocol/mokly-shell-design.md",
    "docs/protocol/mokly-shell-device-chrome.md",
    "docs/protocol/mokly-component-inspector-design.md",
    "docs/protocol/mokly-viewer-palette.md",
  ],
} as const;

/** The Canvas screens of the Changes tab, which also follow the comparisons. */
export const canvasChangesMetadata = {
  ...canvasDesignMetadata,
  relatedDocs: [
    ...canvasDesignMetadata.relatedDocs,
    "docs/protocol/mokly-comparison-panes.md",
  ],
} as const;
