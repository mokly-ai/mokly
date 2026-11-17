import { compareBytewise } from "./api-order";
import { workspace, project } from "./product";
import { siteOrigin } from "./site";

/** One way a published screen is drawn; a link pins the screen and the view. */
export interface ScreenView {
  viewport: "desktop" | "mobile";
  scheme: "light" | "dark";
}

/** One current screen of the published catalogue, as `listScreens` returns it. */
export interface PublicationScreen {
  id: string;
  title: string;
  views: readonly ScreenView[];
}

/**
 * The screen the reader is on, which a copied link pins. Each document's own
 * viewport and scheme give the rest of the link.
 */
export const shareSelection = { screen: "home" } as const;

/** The schemes a screen declares; Mokly gives every screen a light view. */
type ScreenSchemes = readonly ["light"] | readonly ["light", "dark"];

/**
 * One screen in every view that Mokly 0.18.0 draws it in: both viewports, in
 * each scheme that the screen declares.
 */
function drawnScreen(
  id: string,
  title: string,
  schemes: ScreenSchemes,
): PublicationScreen {
  const views = (["desktop", "mobile"] as const).flatMap((viewport) =>
    schemes.map((scheme) => ({ viewport, scheme })),
  );
  return { id, title, views };
}

/**
 * The screens this publication draws, in the order of its own catalogue, which
 * the catalogue drawings keep: Pricing and Checkout are light only.
 */
export const publicationScreens: readonly PublicationScreen[] = [
  drawnScreen("home", "Home", ["light", "dark"]),
  drawnScreen("pricing", "Pricing", ["light"]),
  drawnScreen("checkout", "Checkout", ["light"]),
  drawnScreen("account", "Account", ["light", "dark"]),
];

/**
 * The screens in the order that `listScreens` returns them, which Share
 * offers: current path in bytewise ascending order.
 */
export const listedScreens: readonly PublicationScreen[] =
  publicationScreens.toSorted((left, right) =>
    compareBytewise(left.id, right.id),
  );

const publicationPath =
  "/" +
  workspace.slug +
  "/" +
  project.slug +
  "/publications/2b47e6d1-7c58-4a0b-9d31-6ef0a4c82715";

/**
 * The immutable address of the publication the branch is showing, which the
 * upload answers with and `mokly publish` prints after its result line.
 */
export const publicationAddress = siteOrigin + publicationPath;

/**
 * The mockup-only publication link Share copies; never a live destination.
 * Like `getShareLink`, it carries only the screen and the view values that
 * the selection names, form-encoded in the operation's key order.
 */
export function publicationLink(
  selection: Partial<ScreenView> & { screen?: string },
): string {
  const query = new URLSearchParams();
  if (selection.screen) query.set("catalogueScreen", selection.screen);
  if (selection.viewport) query.set("viewport", selection.viewport);
  if (selection.scheme) query.set("scheme", selection.scheme);
  const text = query.toString();
  return publicationAddress + (text === "" ? "" : "?" + text);
}
