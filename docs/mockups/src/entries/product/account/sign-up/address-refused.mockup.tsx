import { defineScreen } from "@mokly/mokly";

import { SignUpAddressRefusedScreen } from "../../../../screens/product/account/sign-up-screen";

export default defineScreen({
  title: "Sign up · Address refused",
  description:
    "Sign up — the address Mokly refused, marked on the Email field with the sentence that says what to do, while Continue with email keeps its own label. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/folio-chrome-account.md",
  ],
  tags: ["product", "folio", "account", "address-refused"],
  render: (_props, { viewport }) => (
    <SignUpAddressRefusedScreen viewport={viewport} />
  ),
});
