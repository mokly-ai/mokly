import { defineScreen } from "@mokly/mokly";

import { SettingsGitHubSuspendedScreen } from "../../../../screens/product/settings/github-pane";

export default defineScreen({
  title: "GitHub accounts · Suspended account",
  description:
    "The organization's installation suspended on GitHub: its row says Suspended and carries Resume on GitHub, which opens a new tab, for every reader. The personal account stays connected. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/github-app.md",
  ],
  tags: ["product", "folio", "settings", "default"],
  render: (_props, context) => (
    <SettingsGitHubSuspendedScreen viewport={context.viewport} />
  ),
});
