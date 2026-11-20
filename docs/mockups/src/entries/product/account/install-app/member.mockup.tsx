import { defineScreen } from "@mokly/mokly";

import { InstallAppMemberScreen } from "../../../../screens/product/account/install-app-screen";

export default defineScreen({
  title: "Install GitHub App · Member",
  description:
    "The install step read by a member, who can create projects but cannot install the App: one line says who can, with no install action, the way back and the line to the CLI form.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-navigation.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  tags: ["product", "folio", "account", "default"],
  render: (_props, { viewport }) => (
    <InstallAppMemberScreen viewport={viewport} />
  ),
});
