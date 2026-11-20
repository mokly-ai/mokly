import { defineScreen } from "@mokly/mokly";

import { SignUpGitHubOpensSoonScreen } from "../../../../screens/product/account/sign-up-screen";

export default defineScreen({
  title: "Sign up · GitHub opens soon",
  description:
    "Sign up — the notice beside Continue with GitHub before that way in is open, with the control at rest and the email form ready. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/folio-chrome-account.md",
  ],
  tags: ["product", "folio", "account", "github-opens-soon"],
  render: (_props, { viewport }) => (
    <SignUpGitHubOpensSoonScreen viewport={viewport} />
  ),
});
