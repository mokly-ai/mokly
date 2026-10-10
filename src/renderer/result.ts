/** Read the complete document from either supported renderer result. */
import { MoklyError } from "../errors.js";

import type { RenderInput } from "./types.js";

/** Retain the runtime result check for JavaScript renderers. */
export function rendererDocument(result: unknown, input: RenderInput): string {
  if (result && typeof result === "object" && "html" in result)
    result = result.html;
  if (typeof result !== "string")
    throw new MoklyError(
      "build-invalid",
      `renderer must return a string or an object with html for ${input.entry.path} (${input.viewport}, ${input.colorScheme})`,
    );
  return result;
}
