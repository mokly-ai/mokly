import type { ArtboardVariant } from "../../parts/artboards.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import { ExampleWorkspace } from "../../parts/example_workspace.js";
import { NavDrawer, NavTree, type NavNode } from "../../parts/nav.js";
import { NAV_TREE } from "../../parts/nav_data.js";
import { WelcomeHead } from "../../parts/screen_heads.js";
import { Shell, type ArtboardViewport } from "../../parts/shell.js";

/**
 * The catalogue of a hidden column. Choosing Welcome in the drawer closes the
 * drawer and keeps the column hidden, so its row opens the hidden state.
 */
const HIDDEN_TREE: readonly NavNode[] = NAV_TREE.map((row) =>
  row.key === "welcome" ? { ...row, to: DESTINATIONS.navigationHidden } : row,
);

/**
 * Welcome on a wide window whose reader hid the catalogue navigation: the
 * top bar shows the menu, the stage takes the column's width, and the menu
 * opens the column as the drawer. A narrow window ignores the choice, so the
 * mobile artboard draws the narrow shell of every other screen.
 */
function HiddenNavigationScreen({
  drawer,
  viewport,
}: {
  /** Whether the drawer of the hidden column is open. */
  drawer: boolean;
  viewport: ArtboardViewport;
}) {
  const tree = {
    activeLabel: "Welcome",
    columnHidden: true,
    nodes: HIDDEN_TREE,
  };
  return (
    <Shell
      aside={drawer ? <NavDrawer {...tree} /> : null}
      design={
        drawer
          ? DESTINATIONS.navigationHiddenDrawer
          : DESTINATIONS.navigationHidden
      }
      hidden
      nav={drawer ? <NavDrawer {...tree} /> : <NavTree {...tree} />}
      viewport={viewport}
    >
      <ExampleWorkspace
        header={
          <WelcomeHead active={viewport === "desktop" ? "both" : "mobile"} />
        }
        subject="welcome"
        viewport={viewport}
      />
    </Shell>
  );
}

export const hiddenNavigationVariant = {
  colorSchemes: ["light"],
  description:
    "Welcome on a wide window with the catalogue navigation hidden: the top bar shows the menu, and the stage takes the column's width.",
  desktop: <HiddenNavigationScreen drawer={false} viewport="desktop" />,
  mobile: <HiddenNavigationScreen drawer={false} viewport="mobile" />,
  rationale:
    "Large previews need the room that the column takes. The hide button at the end of the column head gives that room back, and search and the menu stay in the top bar. A narrow window already hides the column, so it ignores the choice and keeps the narrow shell.",
  slug: "hidden",
  title: "Hidden column",
} satisfies ArtboardVariant;

export const hiddenNavigationDrawerVariant = {
  colorSchemes: ["light"],
  description:
    "The menu opens a hidden column as the drawer of a narrow window, whose head shows the column again.",
  desktop: <HiddenNavigationScreen drawer viewport="desktop" />,
  mobile: <HiddenNavigationScreen drawer viewport="mobile" />,
  rationale:
    "A hidden column uses the one drawer that a narrow window uses, so the reader learns one set of rules. Choosing an entry closes the drawer, and the column stays hidden. Only the drawer of a wide window has Show catalogue navigation.",
  slug: "hidden-drawer",
  title: "Hidden column drawer",
} satisfies ArtboardVariant;
