import type { ReactNode } from "react";

import type { ArtboardVariant } from "../../../parts/artboards.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import { canvasChangesMetadata } from "../../parts/metadata.js";

/**
 * Shared authored evidence for the Comparison evidence screens, which follow
 * the stylesheet evidence contracts as well as the comparisons.
 */
export const evidenceMetadata = {
  ...canvasChangesMetadata,
  relatedDocs: [
    ...canvasChangesMetadata.relatedDocs,
    "docs/protocol/mokly-changes-controls.md",
    "docs/protocol/mokly-css-evidence-shell.md",
    "docs/protocol/mokly-css-evidence-presentation.md",
  ],
} as const;

/** A saved state of an evidence screen, with its artboard in each viewport. */
export function evidenceState(
  slug: string,
  title: string,
  description: string,
  render: (viewport: ArtboardViewport) => ReactNode,
): ArtboardVariant {
  return {
    colorSchemes: evidenceMetadata.colorSchemes,
    description,
    desktop: render("desktop"),
    mobile: render("mobile"),
    slug,
    title,
  };
}
