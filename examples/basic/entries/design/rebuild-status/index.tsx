import { folder } from "@mokly/mokly";

import { rebuildStatusScreens } from "./screens.js";

/**
 * Watched Serve's rebuild status as shell chrome: the failure notice first,
 * as the canonical screen, then its details, progress and a Live workspace.
 */
export const rebuildStatusDesign = folder({
  title: "Update status",
  relatedDocs: [
    "docs/protocol/mokly-rebuild-status-design.md",
    "docs/protocol/mokly-rebuild-status.md",
  ],
  children: rebuildStatusScreens,
});
