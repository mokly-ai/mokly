import { defineScreen } from "@mokly/mokly";

import { SettingsWorkspaceSavingScreen } from "../../../../screens/product/settings/workspace-pane";

export default defineScreen({
  title: "Workspace · Saving",
  description:
    "Workspace — Save changes' write: the control is busy with Saving…, the name it sends stays in its field, screen readers hear Saving settings, and Change, Manage and Create project stay as they were. The pane inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "pending"],
  render: (_props, context) => (
    <SettingsWorkspaceSavingScreen viewport={context.viewport} />
  ),
});
