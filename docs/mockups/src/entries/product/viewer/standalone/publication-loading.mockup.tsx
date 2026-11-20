import { defineScreen } from "@mokly/mokly";

import { ViewerPublicationLoadingScreen } from "../../../../screens/product/viewer/wait-screens";

export default defineScreen({
  title: "Standalone · Publication loading",
  description:
    "Standalone — a publication's address while its publication is read, as every alias and the project's own address open it once they resolve. The address names no reference, so the reference trigger waits as a placeholder in its own frame beside Loading, and the heading names the project alone. The rest of the bar is the loaded bar, and the stage's waiting card names the read.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups-viewer.md",
    "docs/protocol/cloud/viewer-address-state.md",
    "docs/protocol/cloud/viewer-chrome.md",
    "docs/protocol/cloud/folio-chrome.md",
  ],
  tags: ["product", "folio", "viewer", "loading"],
  render: (_props, { viewport }) => (
    <ViewerPublicationLoadingScreen viewport={viewport} />
  ),
});
