import type { DocumentPalette } from "@mokly-cloud/tokens/palettes";

import { variantParent } from "./catalogue-variants";
import type { InventoryRecord } from "./catalogue-variants";

/** The screens that keep permanent paths and their Product folders after Milestone 11D. */
export const folioScreens = [
  {
    path: "product/account/sign-up",
    folder: ["Product", "Account", "Sign up"],
  },
  { path: "product/account/project-created", folder: ["Product", "Account"] },
  { path: "product/settings/sections", folder: ["Product", "Settings"] },
  {
    path: "product/settings/project",
    folder: ["Product", "Settings", "Project"],
  },
  {
    path: "product/settings/workspace",
    folder: ["Product", "Settings", "Workspace"],
  },
] as const;

/**
 * The viewer's permanent screens, which keep their paths and Product folders
 * and render in the Canvas palette.
 */
export const canvasScreens = [
  {
    path: "product/viewer/standalone",
    folder: ["Product", "Viewer", "Standalone"],
  },
  { path: "product/viewer/pull-request", folder: ["Product", "Viewer"] },
  { path: "product/viewer/switcher", folder: ["Product", "Viewer"] },
  { path: "product/viewer/share", folder: ["Product", "Viewer"] },
] as const;

/** Every permanent screen, with the palette its rendered documents carry. */
export const permanentScreens = [
  ...folioScreens.map((screen) => ({ ...screen, palette: "folio" as const })),
  ...canvasScreens.map((screen) => ({ ...screen, palette: "canvas" as const })),
];

/**
 * Product families the catalogue no longer owns. Explore, the former Marketing
 * family and Review left in Milestone 11C; the public site now has distinct
 * `design-site-*` ownership. Interim workspace pages left in Milestone 11F because the
 * viewer is the application and the product has no project or workspace
 * page. Viewer is not among them: Milestone 11D re-authored it on the stage
 * placeholder, and its permanent screens are asserted above.
 */
const retired = ["explore", "marketing", "review", "workspace"] as const;

/**
 * The permanent screens are canonical screens at their permanent paths whose
 * rendered documents carry their palette, Folio or Canvas, and no record of a
 * retired family remains. `palette` gives the palette of an entry's rendered
 * documents.
 */
export function folioInventoryViolations(
  entries: readonly InventoryRecord[],
  palette: (path: string) => DocumentPalette | undefined,
): string[] {
  const problems: string[] = [];
  const byId = new Map(entries.map((entry) => [entry.path, entry]));
  for (const { path, folder, palette: required } of permanentScreens) {
    const entry = byId.get(path);
    if (entry?.kind !== "screen" || variantParent(entry) !== undefined)
      problems.push("canonical permanent screen required: " + path);
    else if (palette(path) !== required)
      problems.push(required + " palette required: " + path);
    else if (
      entry.path.split("/").slice(0, 2).join("/") !==
      folder
        .slice(0, 2)
        .map((part) => part.toLowerCase())
        .join("/")
    )
      problems.push("permanent folder required: " + path);
  }
  for (const entry of entries)
    for (const family of retired)
      if (
        entry.path.startsWith(family + "-") ||
        entry.path === family ||
        entry.path === "product-" + family ||
        entry.path.startsWith("flow-" + family + "-") ||
        entry.path.startsWith(family + "/") ||
        entry.path.startsWith("product/" + family + "/")
      )
        problems.push("retired family entry: " + entry.path);
  return problems;
}
