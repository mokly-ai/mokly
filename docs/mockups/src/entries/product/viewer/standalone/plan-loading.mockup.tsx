import { defineScreen } from "@mokly/mokly";

import { ViewerPlanLoadingScreen } from "../../../../screens/product/viewer/wait-screens";

export default defineScreen({
  title: "Standalone · Plan loading",
  description:
    "Standalone — a private project on the free plan while the workspace read decides whether the reader can open Billing. The project trigger names the workspace by its address until that read answers, and the stage's waiting card names the read.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups-viewer.md",
    "docs/protocol/cloud/viewer-chrome.md",
    "docs/protocol/cloud/folio-chrome.md",
  ],
  tags: ["product", "folio", "viewer", "loading"],
  render: (_props, { viewport }) => (
    <ViewerPlanLoadingScreen viewport={viewport} />
  ),
});
