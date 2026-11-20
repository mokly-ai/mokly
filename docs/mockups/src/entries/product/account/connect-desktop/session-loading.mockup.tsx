import { defineScreen } from "@mokly/mokly";

import { ConnectDesktopSessionLoadingScreen } from "../../../../screens/product/account/connect-desktop-screen";

export default defineScreen({
  title: "Sign in to the Mokly app · Session loading",
  description:
    "The connect page while the session read runs: the confirmation's own layout, with Sign in to the Mokly app, Loading your account… in the line under the title in place of the account, Open Mokly and Use another account drawn disabled, and the identity's placeholder in the header. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups-account-desktop.md",
    "docs/protocol/cloud/desktop-sign-in.md",
    "docs/protocol/cloud/folio-chrome.md",
  ],
  tags: ["product", "folio", "account", "desktop", "loading"],
  render: (_props, { viewport }) => (
    <ConnectDesktopSessionLoadingScreen viewport={viewport} />
  ),
});
