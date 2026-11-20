import { defineScreen } from "@mokly/mokly";

import { ChooseRepositoryOpenScreen } from "../../../../screens/product/account/choose-repository-screen";

export default defineScreen({
  title: "Choose repository · Select open",
  description:
    "The Repository select open over the form: the package's search field, then one section per connected GitHub account, titled with the account name, with the chosen repository marked.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
    "docs/protocol/cloud/shared-control-registrations.md",
  ],
  tags: ["product", "folio", "account", "default"],
  render: (_props, { viewport }) => (
    <ChooseRepositoryOpenScreen viewport={viewport} />
  ),
});
