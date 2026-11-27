import { defineScreen } from "@mokly/mokly";

import { ConnectOpenScreen } from "../../../../../screens/product/account/connect-screen";

export default defineScreen({
  title: "Connect a GitHub account · Select open",
  description:
    "The Workspace select open over the step: the package's search field, the workspaces the reader administers with the chosen one marked, and Create a workspace last, which opens the workspace step and carries the installation on. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups-account.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
    "docs/protocol/cloud/shared-control-registrations.md",
  ],
  tags: ["product", "folio", "account", "default"],
  render: (_props, { viewport }) => <ConnectOpenScreen viewport={viewport} />,
});
