import { defineScreen } from "@mokly/mokly";

import { InvitationAcceptOpenErrorScreen } from "../../../../screens/product/account/invitation-accept-screen";

export default defineScreen({
  title: "Accept invitation · Could not open workspace",
  description: "The invitation is accepted; retry only the workspace read.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-navigation.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  tags: ["product", "folio", "account", "error"],
  render: (_props, { viewport }) => (
    <InvitationAcceptOpenErrorScreen viewport={viewport} />
  ),
});
