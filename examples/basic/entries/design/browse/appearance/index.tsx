import { folder } from "@mokly/mokly";

import { appearanceOverviewScreen } from "./overview.js";
import { appearanceStateScreens } from "./states/screens.js";
import { appearanceStatusScreens } from "./status/screens.js";
import { appearanceWorkspaceScreens } from "./workspaces/screens.js";

/** The canonical appearance screen followed by its three bounded groups. */
export const appearanceDesign = folder({
  children: [
    appearanceOverviewScreen,
    folder({
      children: appearanceStateScreens,
      segment: "states",
      title: "Appearance states",
    }),
    folder({
      children: appearanceWorkspaceScreens,
      segment: "workspaces",
      title: "Panels and comparisons",
    }),
    folder({
      children: appearanceStatusScreens,
      segment: "status",
      title: "Status and recovery",
    }),
  ],
  relatedDocs: ["docs/protocol/mokly-viewer-appearance.md"],
  segment: "appearance",
  title: "Appearance",
});
