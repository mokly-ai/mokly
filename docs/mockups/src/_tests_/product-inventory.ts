/**
 * The catalogue structure the product inventory requires: which screens are
 * parents, which states and situations are their variants, and the folder
 * each screen lives in. The declarations live in `product-situations.ts`.
 * This module reads no build output, so the application's drawing test can
 * import `expectedProductScreens()` before any mockup build.
 */

import type { DocumentPalette } from "@mokly-cloud/tokens/palettes";

import {
  callbackLandingPages,
  callbackLandingScreens,
} from "./callback-landings";
import { screenVariantLimit, variantParent } from "./catalogue-variants";
import type { InventoryRecord } from "./catalogue-variants";
import { productFamilies, productStates } from "./product-families";
import { situationIdentityViolations } from "./product-situation-policy";
import { productSituations, situationStatePaths } from "./product-situations";

type Family = keyof typeof productFamilies;
type Situation = (typeof productSituations)[number];

/** One parent screen the inventory requires and its variants, in authored order. */
export interface ExpectedScreen {
  path: string;
  variants: readonly string[];
  family: Family;
  /** The family screen whose folder this screen shares. */
  owner: string;
}

/** Whether a situation is always a screen beside its parent, never a variant. */
function besideParent(situation: Situation): boolean {
  return "sibling" in situation && situation.sibling;
}

/** The situations directly beneath a screen, or beneath one of its situations. */
function situationsOf(
  family: Family,
  screen: string,
  parent?: string,
): Situation[] {
  return productSituations.filter(
    (situation) =>
      situation.family === family &&
      situation.screen === screen &&
      ("parent" in situation ? situation.parent : undefined) === parent,
  );
}

/** A situation with one drawing and none beneath it can be a variant. */
function singleDrawing(situation: Situation): boolean {
  return (
    situation.states.length === 1 &&
    situationsOf(situation.family, situation.screen, situation.path).length ===
      0
  );
}

/**
 * One screen and the screens its situations need: single-drawing situations
 * are its variants after its states while they fit within the limit;
 * otherwise, whenever a situation has states of its own, and whenever it is
 * declared a sibling of its parent, it is a screen. Its path places it in its
 * parent's folder.
 */
function screensOf(
  path: string,
  states: readonly string[],
  situations: readonly Situation[],
  family: Family,
  owner: string,
): ExpectedScreen[] {
  const singles = situations.filter(
    (situation) => singleDrawing(situation) && !besideParent(situation),
  );
  const fits = states.length + singles.length <= screenVariantLimit;
  const variants = [
    ...states,
    ...(fits ? singles.map(({ path }) => path) : []),
  ];
  return [
    { path, variants, family, owner },
    ...situations
      .filter((situation) => !fits || !singles.includes(situation))
      .flatMap((situation) =>
        screensOf(
          situation.path,
          situationStatePaths(situation).slice(1),
          situationsOf(family, situation.screen, situation.path),
          family,
          owner,
        ),
      ),
  ];
}

/** Every product parent screen the inventory requires. */
export function expectedProductScreens(): ExpectedScreen[] {
  const families = Object.entries(productFamilies) as [
    Family,
    readonly string[],
  ][];
  return [
    ...families.flatMap(([family, names]) =>
      names.flatMap((name) => {
        const path = "product/" + family + "/" + name;
        return screensOf(
          path,
          productStates.slice(1).map((state) => path + "/" + state),
          situationsOf(family, name),
          family,
          path,
        );
      }),
    ),
    ...callbackLandingScreens.map((screen) => ({
      path: screen.path,
      variants: screen.variants,
      family: "account" as const,
      owner: "product/account/callback",
    })),
  ];
}

/** Every product screen and variant, with the state it draws. */
export function inventoryPages(): {
  path: string;
  state:
    | (typeof productStates)[number]
    | (typeof callbackLandingPages)[number]["state"];
}[] {
  const families = Object.entries(productFamilies) as [
    Family,
    readonly string[],
  ][];
  return [
    ...families.flatMap(([family, names]) =>
      names.flatMap((name) =>
        productStates.map((state) => ({
          path:
            "product/" +
            family +
            "/" +
            name +
            (state === "default" ? "" : "/" + state),
          state,
        })),
      ),
    ),
    ...productSituations.flatMap((situation) =>
      situation.states.map((state, index) => ({
        path: situationStatePaths(situation)[index],
        state,
      })),
    ),
    ...callbackLandingPages.map(({ path, state }) => ({ path, state })),
  ];
}

/**
 * The palette a product page renders in: the viewer family's pages take
 * Canvas, and every other product page takes Folio.
 */
export function productPalette(path: string): DocumentPalette {
  return path.startsWith("product/viewer/") ? "canvas" : "folio";
}

/**
 * The catalogue index holds exactly the product screens that the inventory
 * declares, each parent with its variants in authored order, and every one
 * of them renders in its family's palette, Canvas or Folio. `palette` gives
 * the palette of an entry's rendered documents.
 */
export function productInventoryViolations(
  entries: readonly InventoryRecord[],
  palette: (path: string) => DocumentPalette | undefined,
): string[] {
  const byId = new Map(entries.map((entry) => [entry.path, entry]));
  const problems = situationIdentityViolations(productSituations);
  const expected = expectedProductScreens();
  for (const screen of expected) {
    const entry = byId.get(screen.path);
    if (
      entry?.kind !== "screen" ||
      variantParent(entry) !== undefined ||
      palette(screen.path) !== productPalette(screen.path)
    ) {
      problems.push("parent screen in its family's palette: " + screen.path);
      continue;
    }
    const variants = entries
      .filter((candidate) => variantParent(candidate) === screen.path)
      .map(({ path }) => path);
    if (variants.join() !== screen.variants.join())
      problems.push("variants in authored order: " + screen.path);
    for (const path of screen.variants) {
      const variant = byId.get(path);
      if (variant?.kind !== "screen" || palette(path) !== productPalette(path))
        problems.push("variant in its family's palette: " + path);
    }
    if (!entry.path.startsWith("product/" + screen.family + "/"))
      problems.push("family path: " + screen.path);
  }
  const required = expected
    .flatMap((screen) => [screen.path, ...screen.variants])
    .sort();
  const declared = inventoryPages()
    .map(({ path }) => path)
    .sort();
  if (required.join() !== declared.join())
    problems.push("structure covers the declared inventory");
  const actual = entries
    .filter(
      (entry) => entry.kind === "screen" && entry.path.startsWith("product/"),
    )
    .map((entry) => entry.path)
    .sort();
  if (actual.join() !== required.join())
    problems.push("complete product inventory required");
  return problems;
}
