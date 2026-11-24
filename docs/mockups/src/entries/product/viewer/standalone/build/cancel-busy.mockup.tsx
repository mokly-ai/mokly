import { defineScreen } from "@mokly/mokly";

import { ViewerBuildCancelBusyScreen } from "../../../../../screens/product/viewer/build-busy-screen";

export default defineScreen({
  title: "Build · Cancel · Busy",
  description:
    "Build — Cancel while its request runs: the running build's card keeps its steps and live output, Cancel reads Cancelling… with the busy spinner and stays focusable, and screen readers hear Cancelling this build. The card inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
  ],
  tags: ["product", "canvas", "viewer", "pending"],
  render: (_props, { viewport }) => (
    <ViewerBuildCancelBusyScreen viewport={viewport} />
  ),
});
