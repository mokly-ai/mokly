import { defineScreen } from "@mokly/mokly";

import { InstallAppReviewerScreen } from "../../../../screens/product/account/install-app-screen";

export default defineScreen({
  title: "Install GitHub App · Reviewer",
  description:
    "The install step read by a reviewer, who can create no project: the title says the workspace has none and the line says who creates the first. There is no action and no line to the CLI form.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-navigation.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  tags: ["product", "folio", "account", "default"],
  render: (_props, { viewport }) => (
    <InstallAppReviewerScreen viewport={viewport} />
  ),
});
