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
        "Each interface and preview pairing, the light-only fallback, and the Auto setting.",
      id: "design-appearance-states",
      segment: "states",
      title: "Appearance states",
    }),
    collection({
      children: appearanceWorkspaceScreens,
      description:
        "Panels, the drawer and comparisons drawn in the dark interface.",
      id: "design-appearance-workspaces",
      segment: "workspaces",
      title: "Panels and comparisons",
    }),
    collection({
      children: appearanceStatusScreens,
      description:
        "Home, loading, recovery and use-case routes drawn in the dark interface.",
      id: "design-appearance-status",
      segment: "status",
      title: "Status and recovery",
    }),
  ],
  description:
    "Auto, Light and Dark for the catalogue around previews, independent of each preview's own colour scheme.",
  id: "design-appearance",
  relatedDocs: ["docs/protocol/mokly-viewer-appearance.md"],
  segment: "appearance",
  title: "Appearance",
});
