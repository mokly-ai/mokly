/** Generation-tagged generated inputs for incremental resource watch discovery. */
import { isSafeCatalogueRoute, isSafeRepositoryPath } from "@mokly/viewer/data";

import type { ResourceSeed } from "../../build/html_links.js";

export interface PreviewObservation {
  generation: string;
  documents: readonly (readonly [string, string])[];
  resourceSeeds?: readonly ResourceSeed[];
}

export function parsePreviewObservation(
  value: unknown,
): PreviewObservation | undefined {
  if (!value || typeof value !== "object") return;
  const candidate = value as Partial<PreviewObservation>;
  if (
    typeof candidate.generation !== "string" ||
    !/^[a-f0-9]{32}$/.test(candidate.generation) ||
    !Array.isArray(candidate.documents)
  )
    return;
  if (
    candidate.resourceSeeds !== undefined &&
    (!Array.isArray(candidate.resourceSeeds) ||
      candidate.resourceSeeds.some(
        (seed) =>
          !seed ||
          typeof seed.path !== "string" ||
          !isSafeRepositoryPath(seed.path) ||
          typeof seed.sourceRoute !== "string" ||
          !isSafeCatalogueRoute(seed.sourceRoute),
      ))
  )
    return;
  let bytes = 0;
  for (const item of candidate.documents) {
    if (
      !Array.isArray(item) ||
      item.length !== 2 ||
      typeof item[0] !== "string" ||
      !isSafeCatalogueRoute(item[0]) ||
      typeof item[1] !== "string"
    )
      return;
    bytes += Buffer.byteLength(item[1]);
    if (bytes > 64 * 1024 * 1024) return;
  }
  return candidate as PreviewObservation;
}
