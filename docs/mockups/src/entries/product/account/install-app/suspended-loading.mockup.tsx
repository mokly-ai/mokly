import { defineScreen } from "@mokly/mokly";

import { InstallAppSuspendedLoadingScreen } from "../../../../screens/product/account/install-app-screen";

export default defineScreen({
  title: "Install GitHub App · Suspended, loading",
  description:
    "The suspension read by an owner or admin while the installation list that holds its link is read: Suspended stays, a placeholder holds the place of Resume on GitHub, and screen readers hear Loading GitHub installation. The action and the line to the CLI form stay. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups-account.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  tags: ["product", "folio", "account", "loading"],
  render: (_props, { viewport }) => (
    <InstallAppSuspendedLoadingScreen viewport={viewport} />
  ),
});
