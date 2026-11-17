import type { DocumentPalette } from "@mokly-cloud/tokens/palettes";

import type { RenderInput } from "@mokly/mokly";

/** The entry path roots whose screens render in the Folio palette. */
const folioRoots = ["product", "design/site", "design/email"] as const;

/**
 * The palette of one document, chosen from its entry's kind and path, because
 * Mokly passes the renderer no tags. A component page keeps paper. A screen
 * under a Folio root takes Folio with its scoped control theme, and every
 * other screen, such as the token inventory, keeps the base palette.
 */
export function documentPalette(
  entry: Pick<RenderInput["entry"], "kind" | "path">,
): DocumentPalette {
  if (entry.kind === "component") return "paper";
  const folio = folioRoots.some(
    (root) => entry.path === root || entry.path.startsWith(root + "/"),
  );
  return folio ? "folio" : "default";
}
