import type { ReactNode } from "react";

import type { ArtboardVariant } from "../../../parts/artboards.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import { canvasChangesMetadata } from "../../parts/metadata.js";

/** Shared authored evidence of a removed entry's previous version. */
export const removedMetadata = {
  ...canvasChangesMetadata,
  relatedDocs: [
    ...canvasChangesMetadata.relatedDocs,
    "docs/protocol/mokly-removed-previews.md",
    "docs/protocol/mokly-changes-controls.md",
  ],
} as const;

/** A saved state of a removed outcome, with its artboard in each viewport. */
export function removedState(
  slug: string,
  title: string,
  description: string,
  render: (viewport: ArtboardViewport) => ReactNode,
): ArtboardVariant {
  return {
    colorSchemes: removedMetadata.colorSchemes,
    description,
    desktop: render("desktop"),
    mobile: render("mobile"),
    slug,
    title,
  };
}
