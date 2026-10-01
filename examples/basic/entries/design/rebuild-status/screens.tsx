import { screen } from "@mokly/mokly";

import { componentStyleDependencies } from "../components/parts/styles.js";
import { WorkspaceModeScreen } from "../interactive/parts/workspace_screen.js";
import { DESTINATIONS } from "../parts/destinations.js";
import { ExampleWorkspace } from "../parts/example_workspace.js";
import { NavTree } from "../parts/nav.js";
import type { RebuildDepiction } from "../parts/rebuild_status.js";
import { WelcomeHead } from "../parts/screen_heads.js";
import { Shell, type ArtboardViewport } from "../parts/shell.js";

/**
 * The selected Welcome screen with Static chosen, drawn as the Static gallery
 * draws it and linked as the catalogue's canonical screen; only the depicted
 * status is added.
 */
function StatusScreen({
  rebuild,
  viewport,
}: {
  rebuild: RebuildDepiction;
  viewport: ArtboardViewport;
}) {
  return (
    <Shell
      design={DESTINATIONS.welcome}
      rebuild={rebuild}
      viewport={viewport}
      nav={viewport === "desktop" ? <NavTree activeLabel="Welcome" /> : null}
    >
      <WelcomeHead active={viewport} />
      <ExampleWorkspace subject="welcome" viewport={viewport} />
    </Shell>
  );
}

const FAILURE = { failure: "collapsed" } as const;
const DETAILS = { failure: "open" } as const;
const UPDATING = { updating: true } as const;
const FAILURE_UPDATING = { failure: "collapsed", updating: true } as const;

export function RebuildFailureDesktop() {
  return <StatusScreen rebuild={FAILURE} viewport="desktop" />;
}
export function RebuildFailureMobile() {
  return <StatusScreen rebuild={FAILURE} viewport="mobile" />;
}
export function RebuildDetailsDesktop() {
  return <StatusScreen rebuild={DETAILS} viewport="desktop" />;
}
export function RebuildDetailsMobile() {
  return <StatusScreen rebuild={DETAILS} viewport="mobile" />;
}
export function RebuildUpdatingDesktop() {
  return <StatusScreen rebuild={UPDATING} viewport="desktop" />;
}
export function RebuildUpdatingMobile() {
  return <StatusScreen rebuild={UPDATING} viewport="mobile" />;
}
export function RebuildFailureUpdatingDesktop() {
  return <StatusScreen rebuild={FAILURE_UPDATING} viewport="desktop" />;
}
export function RebuildFailureUpdatingMobile() {
  return <StatusScreen rebuild={FAILURE_UPDATING} viewport="mobile" />;
}
export function RebuildLiveComponentDesktop() {
  return <WorkspaceModeScreen live rebuild={FAILURE} viewport="desktop" />;
}
export function RebuildLiveComponentMobile() {
  return <WorkspaceModeScreen live rebuild={FAILURE} viewport="mobile" />;
}

/**
 * The five rebuild status states. The failure notice is the canonical screen;
 * every state keeps its existing workspace and adds only shell chrome.
 */
export const rebuildStatusScreens = [
  screen({
    id: "design-rebuild-failure",
    title: "Changes not loaded",
    colorSchemes: ["light"],
    description:
      "The latest saved changes could not be loaded, so a full-width notice below the top bar says so while the last working version stays on screen.",
    desktop: <RebuildFailureDesktop />,
    mobile: <RebuildFailureMobile />,
  }),
  screen({
    id: "design-rebuild-details",
    title: "Details open",
    colorSchemes: ["light"],
    description:
      "The same notice with its disclosure open: the developer detail keeps its line breaks and wraps inside a bounded block.",
    desktop: <RebuildDetailsDesktop />,
    mobile: <RebuildDetailsMobile />,
  }),
  screen({
    id: "design-rebuild-updating",
    title: "Updating",
    colorSchemes: ["light"],
    description:
      "An update that takes more than a second shows quiet progress beside the search field; nothing else moves.",
    desktop: <RebuildUpdatingDesktop />,
    mobile: <RebuildUpdatingMobile />,
  }),
  screen({
    id: "design-rebuild-failure-updating",
    title: "Updating after a failure",
    colorSchemes: ["light"],
    description:
      "Saving again keeps the notice in place while the delayed progress also shows.",
    desktop: <RebuildFailureUpdatingDesktop />,
    mobile: <RebuildFailureUpdatingMobile />,
  }),
  screen({
    id: "design-rebuild-live-component",
    title: "Live component",
    colorSchemes: ["light"],
    dependencies: componentStyleDependencies,
    description:
      "A saved component example with Live selected shows the same collapsed notice as a Static screen, outside the preview.",
    desktop: <RebuildLiveComponentDesktop />,
    mobile: <RebuildLiveComponentMobile />,
  }),
];
