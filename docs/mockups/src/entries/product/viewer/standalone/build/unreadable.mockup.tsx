import { defineScreen } from "@mokly/mokly";

import { ViewerBuildUnreadableScreen } from "../../../../../screens/product/viewer/build-screen";

export default defineScreen({
  title: "Build · Couldn’t load",
  description:
    "Build — the first read of the build failed for another reason than the build being absent. The reader is not told it is gone, so asking again is the one thing on offer; the chrome names This build, because no read has reached its branch.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
  ],
  tags: ["product", "folio", "viewer", "unreadable"],
  render: (_props, { viewport }) => (
    <ViewerBuildUnreadableScreen viewport={viewport} />
  ),
});
