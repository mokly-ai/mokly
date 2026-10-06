import type { ResolvedConfig } from "../../packages/mokly/dist/config/types.js";
import type { PublicationOptions } from "../../packages/mokly/dist/publication/options.js";

/** Capture already-built output; callers must build/check before publication. */
export function buildPreview(
  config: ResolvedConfig,
  output: string,
  options?: PublicationOptions,
): Promise<void>;
