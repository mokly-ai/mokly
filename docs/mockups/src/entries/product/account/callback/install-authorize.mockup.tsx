import { defineScreen } from "@mokly/mokly";

import { InstallAuthorizeScreen } from "../../../../screens/product/account/github-landing-screen";

export default defineScreen({
  title: "GitHub installation · Completing authorization",
  description:
    "The authorization callback of an installation while it connects the GitHub account to the workspace: GitHub installation over one state card in placeholder form, whose title says Completing installation…. Its success opens the install step, which hands a connected workspace on to the repository step.",
  relatedDocs: [
    "docs/protocol/cloud/auth-callbacks.md",
    "docs/protocol/cloud/github-app.md",
    "docs/protocol/cloud/product-mockups-account.md",
  ],
  tags: ["product", "folio", "account", "callback", "github", "pending"],
  render: (_props, { viewport }) => (
    <InstallAuthorizeScreen viewport={viewport} />
  ),
});
