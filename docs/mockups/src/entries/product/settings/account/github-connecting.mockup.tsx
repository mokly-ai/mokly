import { defineScreen } from "@mokly/mokly";

import { SettingsAccountGitHubConnectingScreen } from "../../../../screens/product/settings/account-pane";

export default defineScreen({
  title: "Account · Connecting to GitHub",
  description:
    "Account — Connect GitHub's write: the control keeps its place and reads Connecting… with the busy spinner until the page leaves for GitHub, screen readers hear Connecting to GitHub, and the rest of the pane stays at rest. The pane inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/folio-chrome.md",
  ],
  tags: ["product", "folio", "settings", "pending"],
  render: (_props, context) => (
    <SettingsAccountGitHubConnectingScreen viewport={context.viewport} />
  ),
});
