import { defineScreen } from "@mokly/mokly";

import { ChooseRepositoryCreatingScreen } from "../../../../screens/product/account/choose-repository-screen";

export default defineScreen({
  title: "Choose repository · Creating",
  description:
    "Create project while its write runs: the form keeps the chosen repository, the config path and the slug read only, Create project reads Creating… with the busy spinner, and screen readers hear Creating project. The form inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups-account.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  tags: ["product", "folio", "account", "loading"],
  render: (_props, { viewport }) => (
    <ChooseRepositoryCreatingScreen viewport={viewport} />
  ),
});
