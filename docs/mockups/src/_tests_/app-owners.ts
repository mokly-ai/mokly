/**
 * Who answers for each drawn screen.
 *
 * The catalogue is the specification and the application is what shipped, so
 * every comparison between them starts here: which application source renders
 * one screen, and which region of the drawn page that source is answerable
 * for. Declared rather than inferred, so the comparison in `app-parity.ts` has
 * no heuristics to be wrong about.
 */

import { resolve } from "node:path";

import type { Owner } from "./app-regions";
import { callbackLandingPages } from "./callback-landings";
import { catalogueRoot, screenView } from "./catalogue-paths";
import { accountOwners } from "./owners/account";
import { billingOwners } from "./owners/billing";
import { buildOwners } from "./owners/build";
import { memberRemovalOwners } from "./owners/member-removal";
import { memberOwners } from "./owners/members";
import { projectOwners } from "./owners/project";
import { viewerPanelOwners } from "./owners/viewer-panels";
import { viewerStageOwners } from "./owners/viewer-stage";
import { workspaceOwners } from "./owners/workspace";
import { productFamilies, productStates } from "./product-families";
import { productSituations, situationStatePaths } from "./product-situations";

export const repository = resolve(catalogueRoot, "../..");

const owners = {
  ...accountOwners,
  ...workspaceOwners,
  ...memberOwners,
  ...billingOwners,
  ...memberRemovalOwners,
  ...projectOwners,
  ...viewerStageOwners,
  ...buildOwners,
  ...viewerPanelOwners,
} as const satisfies Record<ScreenId, Owner>;

/**
 * The callback landing pages a module of their own draws. One component draws
 * the pending landing and every failure, so those pages answer to
 * `product/account/callback`; each page named here answers for itself.
 */
const separateCallbacks = [
  "product/account/callback/desktop-expired",
  "product/account/callback/install-requested",
  "product/account/callback/install-conflict",
  "product/account/callback/install-denied",
  "product/account/callback/install-setup",
  "product/account/callback/install-authorize",
] as const;

/**
 * Every screen the catalogue owns, derived from the inventory it is declared
 * in. `owners` is keyed by this union, so a screen added to the inventory
 * without an owner is a type error rather than a crash at the first read.
 */
export type ScreenId =
  | {
      [
        Family in keyof typeof productFamilies
      ]: `product/${Family}/${(typeof productFamilies)[Family][number]}`;
    }[keyof typeof productFamilies]
  | (typeof productSituations)[number]["path"]
  | "product/account/callback"
  | (typeof separateCallbacks)[number];

/** The screen one callback landing page, or one of its variants, answers to. */
function callbackScreen(page: string): ScreenId {
  return (
    separateCallbacks.find(
      (screen) => page === screen || page.startsWith(screen + "/"),
    ) ?? "product/account/callback"
  );
}

/** The declared owner of one screen, read through the shape above. */
export function ownerOf(screen: ScreenId): Owner {
  return owners[screen] as Owner;
}

/** Every screen the table declares, with its owner. */
export function declared(): [ScreenId, Owner][] {
  return (Object.keys(owners) as ScreenId[]).map((screen) => [
    screen,
    ownerOf(screen),
  ]);
}

/** The repair a missing owner file needs, in place of a read that throws. */
export function missingOwner(screen: string, path: string): Error {
  return new Error("declare the new owner for " + screen + ": " + path);
}

/** Every catalogued screen with the page and the owner its labels answer to. */
export function parityPages(): {
  screen: ScreenId;
  id: string;
  file: string;
}[] {
  const states = Object.entries(productFamilies).flatMap(([family, screens]) =>
    screens.flatMap((screen) =>
      productStates.map((state) => {
        const id =
          "product/" +
          family +
          "/" +
          screen +
          (state === "default" ? "" : "/" + state);
        return {
          screen: ("product/" + family + "/" + screen) as ScreenId,
          id,
          file: screenView(id, "desktop"),
        };
      }),
    ),
  );
  const situations = productSituations.flatMap((situation) =>
    situationStatePaths(situation).map((id) => ({
      screen: situation.path,
      id,
      file: screenView(id, "desktop"),
    })),
  );
  const callbacks = callbackLandingPages.map((page) => ({
    screen: callbackScreen(page.path),
    id: page.path,
    file: screenView(page.path, "desktop"),
  }));
  return [...states, ...situations, ...callbacks];
}
