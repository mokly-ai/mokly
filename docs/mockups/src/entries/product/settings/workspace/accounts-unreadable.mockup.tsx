import { defineScreen } from "@mokly/mokly";

import { SettingsWorkspaceAccountsUnreadableScreen } from "../../../../screens/product/settings/workspace-pane";

export default defineScreen({
  title: "Workspace · GitHub accounts unread",
  description:
    "Workspace — the GitHub accounts fact when its read of the installation list failed: Couldn’t load and a quiet Try again stand in for the names, and the rest of the pane stays. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/settings-dialog-github.md",
  ],
  tags: ["product", "folio", "settings", "default"],
  render: (_props, context) => (
    <SettingsWorkspaceAccountsUnreadableScreen viewport={context.viewport} />
  ),
});
