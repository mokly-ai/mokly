import type { ReviewArtifactContent, StaticDelivery } from "@mokly/viewer/data";

import { CATALOGUE_PATH } from "../catalogue/serialization.js";

import { exportError } from "./error.js";
import { EXPORT_MARKER } from "./ownership.js";
import { assertPortableExportPath } from "./portable_path.js";

/** Validate adapter-declared root metadata added during its transform. */
export function publicationMetadataPaths(
  declared: readonly string[] | undefined,
  before: ReadonlySet<string>,
  after: ReadonlyMap<string, ReviewArtifactContent>,
  shells: ReadonlyMap<string, StaticDelivery>,
): ReadonlySet<string> {
  if (declared === undefined) return new Set();
  if (!Array.isArray(declared)) throw invalid("<declaration>");
  const accepted = new Set<string>();
  for (const name of declared) {
    if (typeof name !== "string") throw invalid("<declaration>");
    assertPortableExportPath(name);
    if (
      name.includes("/") ||
      name === EXPORT_MARKER ||
      name === CATALOGUE_PATH ||
      shells.has(name) ||
      before.has(name) ||
      !after.has(name) ||
      accepted.has(name)
    )
      throw invalid(name);
    accepted.add(name);
  }
  return accepted;
}

function invalid(name: string) {
  return exportError(
    `Publication metadata path is invalid: ${JSON.stringify(name)}.`,
  );
}
