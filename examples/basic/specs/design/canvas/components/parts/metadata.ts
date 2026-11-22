import type { ReactNode } from "react";

import type { ArtboardVariant } from "../../../parts/artboards.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import { canvasDesignMetadata } from "../../parts/metadata.js";

/** Shared authored evidence for the Component explorer screens. */
export const explorerMetadata = {
  ...canvasDesignMetadata,
  relatedDocs: [
    ...canvasDesignMetadata.relatedDocs,
    "docs/protocol/mokly-component-explorer.md",
    "docs/protocol/mokly-variant-navigation.md",
  ],
} as const;

/** The explorer screens of the Changes tab, which follow the comparisons. */
export const explorerChangesMetadata = {
  ...explorerMetadata,
  relatedDocs: [
    ...explorerMetadata.relatedDocs,
    "docs/protocol/mokly-component-changes.md",
    "docs/protocol/mokly-comparison-panes.md",
  ],
} as const;

/** A saved state of an explorer screen, with its artboard in each viewport. */
export function explorerState(
  slug: string,
  title: string,
  description: string,
  render: (viewport: ArtboardViewport) => ReactNode,
): ArtboardVariant {
  return {
    colorSchemes: canvasDesignMetadata.colorSchemes,
    description,
    desktop: render("desktop"),
    mobile: render("mobile"),
    slug,
    title,
  };
}
