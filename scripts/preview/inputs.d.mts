import type { ManifestV8 } from "@mokly/viewer/data";

import type { Compilation } from "../../dist/build/compile.js";
import type { ResolvedConfig } from "../../dist/config/types.js";

/** Fingerprint pinned authored inputs and the manifest's complete source inventory. */
export function capturePublicationInputs(
  config: ResolvedConfig,
  excludedRoots: readonly string[],
  compilation?: Compilation,
): Promise<{ fingerprint: string; manifest: ManifestV8 }>;
