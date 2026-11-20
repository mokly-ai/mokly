import { defineScreen } from "@mokly/mokly";

import { ChooseRepositoryOneAccountScreen } from "../../../../screens/product/account/choose-repository-screen";

export default defineScreen({
  title: "Choose repository · One account",
  description:
    "A workspace with one connected GitHub account: the select stays flat, and the manage line opens that installation's own page on GitHub in a new tab.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  tags: ["product", "folio", "account", "default"],
  render: (_props, { viewport }) => (
    <ChooseRepositoryOneAccountScreen viewport={viewport} />
  ),
});
