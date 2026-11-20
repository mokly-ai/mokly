import { defineScreen } from "@mokly/mokly";

import { SignInAddressRefusedScreen } from "../../../../screens/product/account/sign-in-screen";

export default defineScreen({
  title: "Sign in · Address refused",
  description:
    "Sign in — the address Mokly refused, marked on the Email field with the sentence that says what to do, while Continue with email keeps its own label. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/folio-chrome-account.md",
  ],
  tags: ["product", "folio", "account", "address-refused"],
  render: (_props, { viewport }) => (
    <SignInAddressRefusedScreen viewport={viewport} />
  ),
});
