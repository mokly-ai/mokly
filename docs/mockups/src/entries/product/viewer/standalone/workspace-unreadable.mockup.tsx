import { defineScreen } from "@mokly/mokly";

import { ViewerStandaloneWorkspaceUnreadableScreen } from "../../../../screens/product/viewer/standalone-screen";

export default defineScreen({
  title: "Standalone · Workspace couldn’t load",
  description:
    "Standalone — a private project whose publishing capability is known but whose workspace ownership could not be read. The ownership read only decides whether this reader can open Billing, so the stage names the workspace it could not load and offers that read again; the switcher the chrome holds stays where it is.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-plan-gates.md",
  ],
  tags: ["product", "canvas", "viewer", "workspace-unreadable"],
  render: (_props, { viewport }) => (
    <ViewerStandaloneWorkspaceUnreadableScreen viewport={viewport} />
  ),
});
