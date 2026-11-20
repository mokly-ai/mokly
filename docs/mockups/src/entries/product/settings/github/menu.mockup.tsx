import { defineScreen } from "@mokly/mokly";

import { SettingsGitHubMenuScreen } from "../../../../screens/product/settings/github-pane";

export default defineScreen({
  title: "GitHub accounts · Row actions",
  description:
    "The organization row's own actions, open: Manage on GitHub, which opens the installation's page in a new tab, and Remove. An anchored popover on desktop and a bottom sheet titled with the account on mobile. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/shared-controls.md",
  ],
  tags: ["product", "folio", "settings", "menu"],
  render: (_props, context) => (
    <SettingsGitHubMenuScreen viewport={context.viewport} />
  ),
});
