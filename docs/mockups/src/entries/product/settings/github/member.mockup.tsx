import { defineScreen } from "@mokly/mokly";

import { SettingsGitHubMemberScreen } from "../../../../screens/product/settings/github-pane";

export default defineScreen({
  title: "GitHub accounts · Member",
  description:
    "The same accounts read by a member, who can read them but act on none: no row menu and no Add GitHub account. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/github-app.md",
  ],
  tags: ["product", "folio", "settings", "default"],
  render: (_props, context) => (
    <SettingsGitHubMemberScreen viewport={context.viewport} />
  ),
});
