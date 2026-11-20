import { defineScreen } from "@mokly/mokly";

import { InstallSetupScreen } from "../../../../screens/product/account/github-landing-screen";

export default defineScreen({
  title: "GitHub installation · Completing setup",
  description:
    "The setup landing while it completes the installation that GitHub returned: Install the Mokly app over one state card in placeholder form, whose title says Completing installation…. Its success leaves for GitHub's authorization.",
  relatedDocs: [
    "docs/protocol/cloud/auth-callbacks.md",
    "docs/protocol/cloud/github-app.md",
    "docs/protocol/cloud/product-mockups-account.md",
  ],
  tags: ["product", "folio", "account", "callback", "github", "pending"],
  render: (_props, { viewport }) => <InstallSetupScreen viewport={viewport} />,
});
