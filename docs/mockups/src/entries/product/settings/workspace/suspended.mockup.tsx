import { defineScreen } from "@mokly/mokly";

import { SettingsWorkspaceSuspendedScreen } from "../../../../screens/product/settings/workspace-pane";

export default defineScreen({
  title: "Workspace · Suspended account",
  description:
    "Workspace — the one connected account suspended on GitHub: the GitHub accounts fact reads its name and Suspended, and Manage opens the pane that holds Resume on GitHub. A new project starts at the install step. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/github-app.md",
  ],
  tags: ["product", "folio", "settings", "default"],
  render: (_props, context) => (
    <SettingsWorkspaceSuspendedScreen viewport={context.viewport} />
  ),
});
