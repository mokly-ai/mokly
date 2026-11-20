import { defineScreen } from "@mokly/mokly";

import { InstallAppSuspendedUnreadableScreen } from "../../../../screens/product/account/install-app-screen";

export default defineScreen({
  title: "Install GitHub App · Suspended, unread",
  description:
    "The suspension read by an owner or admin when the installation list could not be read: Suspended stays, Couldn’t load and a quiet Try again stand where Resume on GitHub would be, above the same action and the line to the CLI form. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-navigation.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  tags: ["product", "folio", "account", "default"],
  render: (_props, { viewport }) => (
    <InstallAppSuspendedUnreadableScreen viewport={viewport} />
  ),
});
