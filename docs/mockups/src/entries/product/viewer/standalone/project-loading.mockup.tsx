import { defineScreen } from "@mokly/mokly";

import { ViewerProjectLoadingScreen } from "../../../../screens/product/viewer/wait-screens";

export default defineScreen({
  title: "Standalone · Project loading",
  description:
    "Standalone — the viewer's address while its project is read. The cloud frame comes first: the bar's controls wait in their own boxes, those whose labels are known drawn disabled, over the stage's waiting card. The heading names the read for screen readers, so the card's title is a bar.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups-viewer.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/viewer.md",
  ],
  tags: ["product", "folio", "viewer", "loading"],
  render: (_props, { viewport }) => (
    <ViewerProjectLoadingScreen viewport={viewport} />
  ),
});
