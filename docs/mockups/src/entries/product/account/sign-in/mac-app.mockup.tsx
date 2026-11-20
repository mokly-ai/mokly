import { defineScreen } from "@mokly/mokly";

import { SignInMacAppScreen } from "../../../../screens/product/account/sign-in-screen";

export default defineScreen({
  title: "Sign in · Mac app",
  description:
    "Sign in — the account entry in the Mac app, whose window has no title bar. The window buttons sit over the start of the account header. The desktop view is a wide window; the mobile view is a narrow window. Static controls depict the documented action; no live writes occur.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/folio-chrome-account.md",
    "docs/protocol/cloud/desktop-bundle.md",
  ],
  tags: ["product", "folio", "account", "mac-app"],
  render: (_props, { viewport }) => <SignInMacAppScreen viewport={viewport} />,
});
