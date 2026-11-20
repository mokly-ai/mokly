import { defineScreen } from "@mokly/mokly";

import { ViewerUploadingScreen } from "../../../../screens/product/viewer/wait-screens";

export default defineScreen({
  title: "Standalone · Uploading",
  description:
    "Standalone — the address names a publication that CI still uploads. The chrome says that it is publishing, with its commit, and the stage's waiting card names the wait until the catalogue is ready.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups-viewer.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/viewer.md",
  ],
  tags: ["product", "folio", "viewer", "loading"],
  render: (_props, { viewport }) => (
    <ViewerUploadingScreen viewport={viewport} />
  ),
});
