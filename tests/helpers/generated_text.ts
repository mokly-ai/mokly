import { generatedResourceRoute } from "@mokly/viewer/data";

import type { GeneratedFile } from "../../dist/build/generated_file.js";
import { generatedText } from "../../dist/build/generated_file.js";

/** Read a text-only test document without silently decoding binary output. */
export function textOutput(
  outputs: ReadonlyMap<string, GeneratedFile>,
  route: string,
): string | undefined {
  return generatedText(
    outputs.get(generatedResourceRoute(route) ?? route),
    route,
  );
}
