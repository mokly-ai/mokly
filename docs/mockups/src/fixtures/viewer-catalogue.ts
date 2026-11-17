import { publicationScreens, shareSelection } from "./publication-screens";
import type { ScreenView } from "./publication-screens";

/**
 * How one view compares with the publication's base: the completed
 * classification that the catalogue index records on each view. A screen of
 * this catalogue is current and none is new, so each view changed or not.
 */
export type ViewChange = "changed" | "unmodified";

/** One viewport and scheme that the publication drew a screen in. */
export interface ViewerCatalogueView extends ScreenView {
  /** Whether the view changed since the publication's base. */
  change: ViewChange;
}

/**
 * One screen of the catalogue that the viewer drawings browse, as its
 * navigation row and its header name it, and the views that the stage's
 * frames choose from.
 */
export interface ViewerCatalogueScreen {
  /** The entry path, which Share's screen choice also names. */
  path: string;
  title: string;
  /** Whether the publication's Changes count it as changed. */
  changed: boolean;
  /** Each viewport and scheme that the publication drew it in. */
  views: readonly ViewerCatalogueView[];
}

/** The screens whose drawing changed since the publication's base. */
const changedScreens: readonly string[] = ["home", "pricing"];

/**
 * Each screen with the change of each view, which the publication's screen
 * list does not carry: a changed screen changed in every view it has, so
 * each document of the drawing shows a changed view of it. They keep the
 * order that the published catalogue gives them; `listedScreens`, the API's
 * screen list, sorts them by path instead.
 */
const screens = publicationScreens.map(
  ({ id, title, views }): ViewerCatalogueScreen => {
    const change = changedScreens.includes(id) ? "changed" : "unmodified";
    return {
      path: id,
      title,
      changed: change === "changed",
      views: views.map((view) => ({ ...view, change })),
    };
  },
);

/**
 * The catalogue of the publication that the viewer drawings show: the same
 * current screens that Share offers, under the package's one Specs section,
 * with the screen the reader is on. These are cloud fixtures; no drawing
 * reads a fixture file of an installed package.
 */
export const viewerCatalogue = {
  section: "Specs",
  screens,
  /** The screen the reader is on, which Share's link pins. */
  current: shareSelection.screen,
  /**
   * Whether any screen has a dark view. Then a frame whose viewport has no
   * dark view keeps its light view under Dark and names it Light only.
   */
  hasDarkViews: screens.some(({ views }) =>
    views.some(({ scheme }) => scheme === "dark"),
  ),
} as const;

/** The screen the reader is on, which the header and the frames show. */
export const currentScreen: ViewerCatalogueScreen = (() => {
  const screen = viewerCatalogue.screens.find(
    ({ path }) => path === viewerCatalogue.current,
  );
  if (screen === undefined)
    throw new Error(
      "The current screen " + viewerCatalogue.current + " is missing.",
    );
  return screen;
})();

/**
 * What the sample screen inside the device frames draws: the current screen's
 * title and the other screens it links to, as the published catalogue's own
 * page would. It stays a sample, so it carries no claim about a product.
 */
export const sampleScreen = {
  brand: "Sample",
  title: currentScreen.title,
  links: viewerCatalogue.screens
    .filter(({ path }) => path !== currentScreen.path)
    .map(({ title }) => title),
  /** The number of cards beneath the hero, per viewport. */
  cards: { mobile: 2, desktop: 3 },
} as const;
