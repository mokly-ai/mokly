import type { ManifestV5 } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../../dist/config/types.js";

/** Fingerprint pinned authored inputs and the manifest's complete source inventory. */
export function capturePublicationInputs(
  config: ResolvedConfig,
  excludedRoots: readonly string[],
): Promise<{ fingerprint: string; manifest: ManifestV5 }>;
