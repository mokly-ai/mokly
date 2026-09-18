/** Generation-tagged generated inputs for incremental resource watch discovery. */
import { isSafeCatalogueRoute } from "@mokly/viewer/data";

export interface PreviewObservation {
  generation: string;
  documents: readonly (readonly [string, string])[];
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
