import { defineScreen } from "@mokly/mokly";

import { ViewerBuildTryAgainBusyScreen } from "../../../../../screens/product/viewer/build-busy-screen";

export default defineScreen({
  title: "Build · Try again · Busy",
  description:
    "Build — Try again on the failed install while its build request runs: the card keeps its cause and the output's tail, Try again reads Publishing… with the busy spinner and stays focusable, and screen readers hear Publishing this branch. The card inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
  ],
  tags: ["product", "canvas", "viewer", "pending"],
  render: (_props, { viewport }) => (
    <ViewerBuildTryAgainBusyScreen viewport={viewport} />
  ),
});
