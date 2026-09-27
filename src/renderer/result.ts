/** Validate the runtime renderer result against the string-only public contract. */
import { MoklyError } from "../errors.js";

import type { RenderInput } from "./types.js";

/** Reject JavaScript renderers that bypass the compile-time string contract. */
export function rendererDocument(result: unknown, input: RenderInput): string {
  if (typeof result !== "string")
    throw new MoklyError(
      "build-invalid",
      `renderer must return a string for ${input.entry.id} (${input.viewport}, ${input.colorScheme})`,
    );
  return result;
}
