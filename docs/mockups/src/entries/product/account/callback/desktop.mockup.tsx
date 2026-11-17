import { defineScreen } from "@mokly/mokly";

import { CallbackDesktopHandoffScreen } from "../../../../screens/product/account/callback-screen";

export default defineScreen({
  title: "Email sign-in link · Desktop app",
  description:
    "The email landing in a browser when the desktop app requested the link. Open Mokly hands the link to the app; Continue in browser signs in on this page.",
  relatedDocs: [
    "docs/protocol/cloud/auth-callbacks.md",
    "docs/protocol/cloud/desktop-app.md",
    "docs/protocol/cloud/product-mockups.md",
  ],
  tags: ["product", "folio", "account", "callback", "email", "handoff"],
  render: (_props, { viewport }) => (
    <CallbackDesktopHandoffScreen viewport={viewport} />
  ),
});
