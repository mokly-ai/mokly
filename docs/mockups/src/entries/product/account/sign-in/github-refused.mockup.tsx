import { defineScreen } from "@mokly/mokly";

import { SignInGitHubRefusedScreen } from "../../../../screens/product/account/sign-in-screen";

export default defineScreen({
  title: "Sign in · GitHub refused",
  description:
    "Sign in — the connect Mokly refused, reported beside Continue with GitHub while the email form stays at rest. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/folio-chrome-account.md",
  ],
  tags: ["product", "folio", "account", "github-refused"],
  render: (_props, { viewport }) => (
    <SignInGitHubRefusedScreen viewport={viewport} />
  ),
});
