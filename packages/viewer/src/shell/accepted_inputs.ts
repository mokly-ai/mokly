/** Assign sides to shell evidence already validated by its producer or reader. */

import type { CurrentPath } from "../catalogue/path_types.js";
import type { ComponentRenderSuccess } from "../components/render_types.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellEvidence } from "./metadata.js";

export function acceptedShellCatalogue<Path extends string>(
  catalogue: Catalogue<Path>,
): Catalogue {
  return catalogue as unknown as Catalogue;
}

export function acceptedCurrentPreview(
  preview: ComponentRenderSuccess,
): ComponentRenderSuccess<CurrentPath> {
  return preview as ComponentRenderSuccess<CurrentPath>;
}

/** Retain stored paths and object identity while marking their known sides. */
export function acceptedShellEvidence(
  evidence: ShellEvidence<string>,
): ShellEvidence {
  return evidence as unknown as ShellEvidence;
}
