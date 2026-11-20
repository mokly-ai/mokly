import { defineScreen } from "@mokly/mokly";

import { SettingsWorkspaceAccountsLoadingScreen } from "../../../../screens/product/settings/workspace-pane";

export default defineScreen({
  title: "Workspace · GitHub accounts loading",
  description:
    "Workspace — the GitHub accounts fact while its own read of the installation list runs: a placeholder holds the names' place, the pane around it is drawn, and Manage stays beside it. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/settings-dialog-github.md",
  ],
  tags: ["product", "folio", "settings", "default"],
  render: (_props, context) => (
    <SettingsWorkspaceAccountsLoadingScreen viewport={context.viewport} />
  ),
});
