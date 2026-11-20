import { defineScreen } from "@mokly/mokly";

import { ViewerStandaloneReaderScreen } from "../../../../screens/product/viewer/standalone-screen";

export default defineScreen({
  title: "Standalone · Reader",
  description:
    "Standalone — an unpublished branch read by someone who cannot publish it, so the stage names who does and offers the switcher.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
  ],
  tags: ["product", "canvas", "viewer", "reader"],
  render: (_props, { viewport }) => (
    <ViewerStandaloneReaderScreen viewport={viewport} />
  ),
});
