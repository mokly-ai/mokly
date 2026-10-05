import { componentDesignDocs } from "./components/parts/fixtures.js";
import { componentStyleDependencies } from "./components/parts/styles.js";

/** Shared authored evidence for the shell design screens. */
export const designMetadata = {
  dependencies: [
    "examples/basic/generated/design-stage.css",
    "examples/basic/generated/design.css",
  ],
  relatedDocs: [
    "docs/protocol/mokly-shell-design.md",
    "examples/basic/notes.md",
  ],
};
export const changesDesignMetadata = {
  ...designMetadata,
  dependencies: [
    ...designMetadata.dependencies,
    "examples/basic/generated/design-review.css",
  ],
};
export const appearanceDesignMetadata = {
  ...designMetadata,
  relatedDocs: ["docs/protocol/mokly-viewer-appearance.md"],
};
export const componentDesignMetadata = {
  dependencies: componentStyleDependencies,
  relatedDocs: componentDesignDocs,
};
export const controlsDesignMetadata = {
  dependencies: [
    ...componentStyleDependencies,
    "examples/basic/generated/design-component-controls.css",
  ],
  relatedDocs: [
    "docs/protocol/mokly-component-controls-design.md",
    "docs/protocol/mokly-component-controls.md",
  ],
};
