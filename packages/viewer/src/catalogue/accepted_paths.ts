/** Type the paths of inputs already accepted by their storage validators. */

import type { ManifestV8 } from "../registry/types.js";
import type { Catalogue } from "../shell/catalogue.js";

import type { BranchPointPath, CurrentPath } from "./path_types.js";

/** Current and removed addresses remain current; removed references are before. */
export function acceptedCatalogue<Path extends string>(
  catalogue: Catalogue<Path>,
): Catalogue<CurrentPath> {
  return catalogue as unknown as Catalogue<CurrentPath>;
}

/** An accepted baseline inventory keeps every identity and reference before. */
export function baselineInventory(
  manifest: ManifestV8,
): ManifestV8<BranchPointPath> {
  return manifest as unknown as ManifestV8<BranchPointPath>;
}
