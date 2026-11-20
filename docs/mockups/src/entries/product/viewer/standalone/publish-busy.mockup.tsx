import { defineScreen } from "@mokly/mokly";

import { ViewerPublishBusyScreen } from "../../../../screens/product/viewer/publish-screen";

export default defineScreen({
  title: "Standalone · Publish · Busy",
  description:
    "Standalone — Publish this branch while its build request runs: the control reads Publishing… with the busy spinner and stays focusable, screen readers hear Publishing this branch, and Publish from CI stays beside it. The card inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
  ],
  tags: ["product", "folio", "viewer", "pending"],
  render: (_props, { viewport }) => (
    <ViewerPublishBusyScreen viewport={viewport} />
  ),
});
