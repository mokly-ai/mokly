import { collection } from "@mokly/mokly";

import { appearanceOverviewScreen } from "./overview.js";
import { appearanceStateScreens } from "./states/screens.js";
import { appearanceStatusScreens } from "./status/screens.js";
import { appearanceWorkspaceScreens } from "./workspaces/screens.js";

/** The canonical appearance screen followed by its three bounded groups. */
export const appearanceDesign = collection({
  children: [
    appearanceOverviewScreen,
    collection({
      children: appearanceStateScreens,
      description:
        "The Auto setting and the light-only screen that cannot follow it.",
      id: "design-appearance-states",
      segment: "states",
      title: "Appearance states",
    }),
    collection({
      children: appearanceWorkspaceScreens,
      description: "Panels, the drawer and comparisons in either appearance.",
      id: "design-appearance-workspaces",
      segment: "workspaces",
      title: "Panels and comparisons",
    }),
    collection({
      children: appearanceStatusScreens,
      description:
        "Home, loading, recovery and use-case routes in either appearance.",
      id: "design-appearance-status",
      segment: "status",
      title: "Status and recovery",
    }),
  ],
  description:
    "Auto, Light and Dark for the whole catalogue: one setting takes the chrome and the screens it shows together.",
  id: "design-appearance",
  relatedDocs: ["docs/protocol/mokly-viewer-appearance.md"],
  segment: "appearance",
  title: "Appearance",
});
