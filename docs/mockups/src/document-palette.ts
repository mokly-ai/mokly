import type { DocumentPalette } from "@mokly-cloud/tokens/palettes";

import type { RenderInput } from "@mokly/mokly";

/** The entry path roots whose screens render in the Folio palette. */
const folioRoots = ["product", "design/email"] as const;

/** The entry path roots whose screens render in the Canvas palette. */
const canvasRoots = ["design/site"] as const;

/** Whether an entry path is one of the roots or lies beneath one. */
function under(path: string, roots: readonly string[]): boolean {
  return roots.some((root) => path === root || path.startsWith(root + "/"));
}

/**
 * The palette of one document, chosen from its entry's kind and path, because
 * Mokly passes the renderer no tags. A component page keeps paper. A screen
 * under a Canvas root takes Canvas, a screen under a Folio root takes Folio,
 * each with its scoped control theme, and every other screen, such as the
 * token inventory, keeps the base palette.
 */
export function documentPalette(
  entry: Pick<RenderInput["entry"], "kind" | "path">,
): DocumentPalette {
  if (entry.kind === "component") return "paper";
  if (under(entry.path, canvasRoots)) return "canvas";
  return under(entry.path, folioRoots) ? "folio" : "default";
}
