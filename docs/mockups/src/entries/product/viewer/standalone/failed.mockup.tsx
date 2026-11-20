import { defineScreen } from "@mokly/mokly";

import { ViewerStandaloneFailedScreen } from "../../../../screens/product/viewer/standalone-screen";

export default defineScreen({
  title: "Standalone · Unable to publish",
  description:
    "Standalone — a publication that never arrived, opened as its own details: the branch that could not be published and the one thing the reader can do about it. History and the switcher both open a failed attempt here.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/product-copy.md",
  ],
  tags: ["product", "canvas", "viewer", "failed"],
  render: (_props, { viewport }) => (
    <ViewerStandaloneFailedScreen viewport={viewport} />
  ),
});
