import { componentDesignDocs } from "./components/parts/fixtures.js";

/** Shared authored evidence for the shell design screens. */
export const designMetadata = {
  relatedDocs: [
    "docs/protocol/mokly-shell-design.md",
    "examples/basic/notes.md",
  ],
};
export const changesDesignMetadata = {
  ...designMetadata,
};
export const appearanceDesignMetadata = {
  ...designMetadata,
  relatedDocs: ["docs/protocol/mokly-viewer-appearance.md"],
};
export const componentDesignMetadata = {
  relatedDocs: componentDesignDocs,
};
export const controlsDesignMetadata = {
  relatedDocs: [
    "docs/protocol/mokly-component-controls-design.md",
    "docs/protocol/mokly-component-controls.md",
  ],
};
