import { defineScreen } from "@mokly/mokly";

import { SignInGitHubConnectingScreen } from "../../../../screens/product/account/sign-in-screen";

export default defineScreen({
  title: "Sign in · Connecting to GitHub",
  description:
    "Sign in while Continue with GitHub's write runs: the control keeps its place and reads Connecting… with the busy spinner until the page leaves for GitHub, screen readers hear Connecting to GitHub, and the email form stays at rest. The form inserts nothing. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups-account.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/folio-chrome-account.md",
  ],
  tags: ["product", "folio", "account", "loading"],
  render: (_props, { viewport }) => (
    <SignInGitHubConnectingScreen viewport={viewport} />
  ),
});
