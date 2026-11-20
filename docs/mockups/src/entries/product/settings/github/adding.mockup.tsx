import { defineScreen } from "@mokly/mokly";

import { SettingsGitHubAddingScreen } from "../../../../screens/product/settings/github-pane";

export default defineScreen({
  title: "GitHub accounts · Adding an account",
  description:
    "GitHub accounts — Add GitHub account's write: the control keeps its place and reads Adding… with the busy spinner until the page leaves for GitHub, screen readers hear Adding a GitHub account, and the rows keep their menus. The pane inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/settings-dialog-github.md",
  ],
  tags: ["product", "folio", "settings", "pending"],
  render: (_props, context) => (
    <SettingsGitHubAddingScreen viewport={context.viewport} />
  ),
});
