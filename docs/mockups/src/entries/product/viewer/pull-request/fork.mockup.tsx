import { defineScreen } from "@mokly/mokly";

import { ViewerPullRequestForkScreen } from "../../../../screens/product/viewer/pull-request-screen";

export default defineScreen({
  title: "Pull request · Fork",
  description:
    "Pull request — an open pull request from a fork with nothing published. Builds never run for a fork, so the stage says so, tells the reader to review its screens locally and offers the switcher, never a way to publish it.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
  ],
  tags: ["product", "folio", "viewer", "fork"],
  render: (_props, { viewport }) => (
    <ViewerPullRequestForkScreen viewport={viewport} />
  ),
});
