import { canvasDesignMetadata } from "../../parts/metadata.js";

/** The contracts of the shell's delivery: the stub, the index, the details. */
const DELIVERY_DOCS = [
  "docs/protocol/mokly-shell-delivery.md",
  "docs/protocol/mokly-shell-fences.md",
] as const;

/**
 * The startup pages before the catalogue arrives, which also follow the
 * version gates of the viewer namespace.
 */
export const startupMetadata = {
  ...canvasDesignMetadata,
  relatedDocs: [
    ...canvasDesignMetadata.relatedDocs,
    ...DELIVERY_DOCS,
    "docs/protocol/mokly-viewer-namespace.md",
  ],
} as const;

/** The stage of an entry whose detail loads or failed. */
export const entryLoadingMetadata = {
  ...canvasDesignMetadata,
  relatedDocs: [...canvasDesignMetadata.relatedDocs, ...DELIVERY_DOCS],
} as const;

/** The Changes filter while the comparison is not ready, or absent. */
export const changesStatusMetadata = {
  ...canvasDesignMetadata,
  relatedDocs: [
    ...canvasDesignMetadata.relatedDocs,
    "docs/protocol/mokly-shell-design-navigation.md",
    "docs/protocol/mokly-changes-controls.md",
  ],
} as const;
