import { screen } from "@mokly/mokly";

import {
  DocDetailsScreen,
  DocNavigationScreen,
  DocViewScreen,
  RemovedDocScreen,
} from "./views.js";

/**
 * Owning designs for Markdown docs. Each inherits the catalogue's Light and
 * Dark schemes, so the outer Appearance control moves between its two
 * generated files at the same entry.
 */
export const docScreens = [
  screen({
    id: "design-doc-view",
    title: "Markdown doc",
    description:
      "A Markdown doc in its folder at reading width, in the catalogue's Light or Dark appearance.",
    rationale:
      "Specification prose belongs beside the screens it describes. A doc has one reading layout, so it keeps the plain document pane with no device frames or viewport choice, and it follows the Appearance setting exactly as a screen does.",
    desktop: <DocViewScreen viewport="desktop" />,
    mobile: <DocViewScreen viewport="mobile" />,
  }),
  screen({
    id: "design-doc-details",
    title: "Doc details",
    description:
      "A doc's source, schemes, tags, related docs and dependencies, with a related doc that opens as a link.",
    rationale:
      "Paths read the same for a doc as for a screen, and a related path that names a current doc is the quickest way to open it. The related-doc chip opens the doc design, the one current doc this catalogue draws at reading width.",
    desktop: <DocDetailsScreen viewport="desktop" />,
    mobile: <DocDetailsScreen viewport="mobile" />,
  }),
  screen({
    id: "design-doc-navigation",
    title: "Doc navigation",
    description:
      "A doc selected in the narrow catalogue drawer, and in the persistent navigation on a wide layout.",
    rationale:
      "A doc is an ordinary leaf with its own icon, sorted by title among the entries beside it, so it is found where its folder says rather than in a separate section.",
    desktop: <DocNavigationScreen viewport="desktop" />,
    mobile: <DocNavigationScreen viewport="mobile" />,
  }),
  screen({
    id: "design-doc-removed",
    title: "Removed doc",
    description:
      "A removed doc opens its previous version from a flat Changes row, under the folders it was recorded in.",
    rationale:
      "Deleting a doc should not hide what it said. Only its light view is kept, so a dark catalogue shows that light view and names the fallback rather than inventing a dark one.",
    desktop: <RemovedDocScreen viewport="desktop" />,
    mobile: <RemovedDocScreen viewport="mobile" />,
  }),
];
