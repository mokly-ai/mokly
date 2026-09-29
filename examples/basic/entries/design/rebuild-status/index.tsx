import { collection } from "@mokly/mokly";

import { rebuildStatusScreens } from "./screens.js";

/**
 * Watched Serve's rebuild status as shell chrome: the failure notice first,
 * as the canonical screen, then its details, progress and a Live workspace.
 */
export const rebuildStatusDesign = collection({
  id: "design-rebuild-status",
  segment: "rebuild-status",
  title: "Update status",
  description:
    "The notice shown when the latest saved changes could not be loaded, its details, and the quiet progress shown while an update takes a moment.",
  relatedDocs: [
    "docs/protocol/mokly-rebuild-status-design.md",
    "docs/protocol/mokly-rebuild-status.md",
  ],
  children: rebuildStatusScreens,
});
