import type { ResolvedConfig } from "../../dist/config/types.js";
import type { PublicationOptions } from "../../dist/publication/options.js";

/** Compile and capture in memory without reading or writing local generated output. */
export function buildPreview(
  config: ResolvedConfig,
  output: string,
  options?: PublicationOptions,
): Promise<void>;
