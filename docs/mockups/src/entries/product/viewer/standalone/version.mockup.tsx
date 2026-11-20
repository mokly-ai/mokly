import { defineScreen } from "@mokly/mokly";

import { ViewerVersionScreen } from "../../../../screens/product/viewer/version-screen";

export default defineScreen({
  title: "Standalone · Viewer version",
  description:
    "The published viewer reports an incompatible catalogue. Cloud chrome keeps one Reload action and closed diagnostic details.",
  relatedDocs: [
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/viewer-host.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
    "docs/protocol/cloud/product-copy.md",
  ],
  tags: ["product", "folio", "viewer", "version"],
  render: (_props, { viewport }) => <ViewerVersionScreen viewport={viewport} />,
});
