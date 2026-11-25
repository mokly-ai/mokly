import { defineScreen } from "@mokly/mokly";

import { SignInPasswordSigningInScreen } from "../../../../../screens/product/account/sign-in-screen";

export default defineScreen({
  title: "Sign in · Preview password · Signing in",
  description:
    "Sign in while Continue as preview@mokly.ai's write runs: the control keeps its place and reads Signing in… with the busy spinner until the page leaves for the route the answer returns, screen readers hear Signing you in, and the Password field waits disabled with what the reader typed. The email form stays at rest. The form inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups-account.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/folio-chrome-account.md",
    "docs/protocol/cloud/preview-sign-in.md",
  ],
  tags: ["product", "folio", "account", "loading"],
  render: (_props, { viewport }) => (
    <SignInPasswordSigningInScreen viewport={viewport} />
  ),
});
