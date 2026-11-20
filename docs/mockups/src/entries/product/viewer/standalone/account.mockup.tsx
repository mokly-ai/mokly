import { defineScreen } from "@mokly/mokly";

import { ViewerStandaloneAccountScreen } from "../../../../screens/product/viewer/standalone-screen";

export default defineScreen({
  title: "Standalone · Named by address",
  description:
    "Standalone — a reader who has set no name is called by their email address. A long workspace name truncates in the project switcher, so every action stays on one desktop row, and the avatar shows the address's initials with the whole address as its name and tooltip.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
  ],
  tags: ["product", "canvas", "viewer", "account"],
  render: (_props, { viewport }) => (
    <ViewerStandaloneAccountScreen viewport={viewport} />
  ),
});
