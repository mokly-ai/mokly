import { defineScreen } from "@mokly/mokly";

import { InstallRequestedScreen } from "../../../../screens/product/account/github-landing-screen";

export default defineScreen({
  title: "GitHub installation · Requested",
  description:
    "The setup landing when a member of a GitHub organization requested the App instead of installing it: one line says an organization owner approves it on GitHub, and Back to install. Nothing reached Mokly, so there is no reference.",
  relatedDocs: [
    "docs/protocol/cloud/auth-callbacks.md",
    "docs/protocol/cloud/github-app.md",
    "docs/protocol/cloud/product-mockups.md",
  ],
  tags: ["product", "folio", "account", "callback", "github", "request"],
  render: (_props, { viewport }) => (
    <InstallRequestedScreen viewport={viewport} />
  ),
});
