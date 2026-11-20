import { defineScreen } from "@mokly/mokly";

import { CreateWorkspaceCreatingScreen } from "../../../../screens/product/account/create-workspace-screen";

export default defineScreen({
  title: "Create workspace · Creating",
  description:
    "Create workspace while its write runs: the populated form keeps its place, Create workspace reads Creating… with the busy spinner, and screen readers hear Creating workspace. The form inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups-account.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  tags: ["product", "folio", "account", "loading"],
  render: (_props, { viewport }) => (
    <CreateWorkspaceCreatingScreen viewport={viewport} />
  ),
});
