import { defineScreen } from "@mokly/mokly";

import { InstallDeniedScreen } from "../../../../screens/product/account/github-landing-screen";

export default defineScreen({
  title: "GitHub installation · Not an administrator",
  description:
    "The authorization callback when GitHub could not prove the reader administers the account: the title is the message, announced without a second visible title, with the reference and Back to install.",
  relatedDocs: [
    "docs/protocol/cloud/auth-callbacks.md",
    "docs/protocol/cloud/github-app.md",
    "docs/protocol/cloud/product-mockups.md",
  ],
  tags: ["product", "folio", "account", "callback", "github", "denied"],
  render: (_props, { viewport }) => <InstallDeniedScreen viewport={viewport} />,
});
