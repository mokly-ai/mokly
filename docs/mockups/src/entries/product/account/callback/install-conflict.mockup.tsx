import { defineScreen } from "@mokly/mokly";

import { InstallConflictScreen } from "../../../../screens/product/account/github-landing-screen";

export default defineScreen({
  title: "GitHub installation · Connected elsewhere",
  description:
    "The authorization callback when another workspace already holds the GitHub account: one line says to remove it there first, the reference, and Back to install.",
  relatedDocs: [
    "docs/protocol/cloud/auth-callbacks.md",
    "docs/protocol/cloud/github-app.md",
    "docs/protocol/cloud/product-mockups.md",
  ],
  tags: ["product", "folio", "account", "callback", "github", "conflict"],
  render: (_props, { viewport }) => (
    <InstallConflictScreen viewport={viewport} />
  ),
});
