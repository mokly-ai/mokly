import { defineScreen } from "@mokly/mokly";

import { SettingsWorkspaceAbsentScreen } from "../../../../screens/product/settings/workspace-pane";

export default defineScreen({
  title: "Workspace · No GitHub account",
  description:
    "Workspace — no GitHub account connected, before the first is added and after the last is removed: the GitHub accounts fact reads None, and a new project starts at the install step. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/github-app.md",
  ],
  tags: ["product", "folio", "settings", "default"],
  render: (_props, context) => (
    <SettingsWorkspaceAbsentScreen viewport={context.viewport} />
  ),
});
