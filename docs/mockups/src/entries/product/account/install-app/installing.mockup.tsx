import { defineScreen } from "@mokly/mokly";

import { InstallAppInstallingScreen } from "../../../../screens/product/account/install-app-screen";

export default defineScreen({
  title: "Install GitHub App · Installing",
  description:
    "Install on GitHub while its write runs, read by an owner or admin: the control keeps its place and reads Installing… with the busy spinner until the page leaves for GitHub, screen readers hear Installing the Mokly app, and Back and the line to the CLI form stay. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups-account.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  tags: ["product", "folio", "account", "loading"],
  render: (_props, { viewport }) => (
    <InstallAppInstallingScreen viewport={viewport} />
  ),
});
