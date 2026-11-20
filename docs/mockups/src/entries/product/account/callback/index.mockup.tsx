import { defineScreen } from "@mokly/mokly";

import { CallbackPendingScreen } from "../../../../screens/product/account/callback-screen";

export default defineScreen({
  title: "Sign-in link · Pending",
  description:
    "The shared email, preview and desktop landing while sign-in completes.",

  relatedDocs: [
    "docs/protocol/cloud/auth-callbacks.md",
    "docs/protocol/cloud/product-mockups.md",
  ],
  tags: ["product", "folio", "account", "callback", "pending"],
  render: (_props, { viewport }) => (
    <CallbackPendingScreen viewport={viewport} />
  ),
});
