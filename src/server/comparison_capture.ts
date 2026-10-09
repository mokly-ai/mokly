import {
  generatedResourcePath,
  generatedViews,
  type ManifestV10,
} from "@mokly/viewer/data";

import {
  transferGeneratedFile,
  type GeneratedFile,
} from "../build/generated_file.js";
import type { EvidenceAssetReader } from "../review/evidence_assets.js";

/** Retain exact current view bytes before publishing the comparison generation. */
export async function retainHeadViewDigests(
  manifest: ManifestV10,
  reader: EvidenceAssetReader,
): Promise<void> {
  for (const entry of manifest.entries)
    for (const view of generatedViews(entry)) {
      const route = generatedResourcePath(view.path);
      if (!reader.digests[route]) await reader.read(route);
    }
}

/** Transfer accepted output bytes without reading the generated tree. */
export function transferredHeadOutputs(
  outputs: ReadonlyMap<string, GeneratedFile>,
) {
  return [...outputs].map(
    ([route, content]) => [route, transferGeneratedFile(content)] as const,
  );
}
