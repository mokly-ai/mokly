import { defineScreen } from "@mokly/mokly";

import { InvitationAcceptExpiredScreen } from "../../../../screens/product/account/invitation-accept-screen";

export default defineScreen({
  title: "Accept invitation · Expired",
  description: "The sender needs to issue a fresh invitation.",
  relatedDocs: ["docs/protocol/cloud/product-mockups.md"],
  tags: ["product", "folio", "account", "default"],
  render: (_props, { viewport }) => (
    <InvitationAcceptExpiredScreen viewport={viewport} />
  ),
});
