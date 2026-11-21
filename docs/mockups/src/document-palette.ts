import type { DocumentPalette } from "@mokly-cloud/tokens/palettes";

import type { RenderInput } from "@mokly/mokly";

/** Component pages use paper. Every other document uses the default Canvas family. */
export function documentPalette(
  entry: Pick<RenderInput["entry"], "kind">,
): DocumentPalette {
  return entry.kind === "component" ? "paper" : "default";
}
