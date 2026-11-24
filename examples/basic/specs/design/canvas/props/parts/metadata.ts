import type { ReactNode } from "react";

import type {
  ArtboardVariant,
  ArtboardViewport,
} from "../../../parts/artboards.js";
import { canvasDesignMetadata } from "../../parts/metadata.js";

/**
 * Shared authored evidence for the Props and controls screens, which also
 * follow the controls contracts.
 */
export const propsDesignMetadata = {
  ...canvasDesignMetadata,
  relatedDocs: [
    ...canvasDesignMetadata.relatedDocs,
    "docs/protocol/mokly-component-controls-design.md",
    "docs/protocol/mokly-component-controls.md",
  ],
} as const;

/** A saved state of a Props screen, with its artboard in each viewport. */
export function propsState(
  slug: string,
  title: string,
  description: string,
  render: (viewport: ArtboardViewport) => ReactNode,
): ArtboardVariant {
  return {
    colorSchemes: propsDesignMetadata.colorSchemes,
    description,
    desktop: render("desktop"),
    mobile: render("mobile"),
    slug,
    title,
  };
}
