import { defineScreen } from "@mokly/mokly";

import { ViewerBuildLockfileScreen } from "../../../../../screens/product/viewer/build-screen";

export default defineScreen({
  title: "Build · Lockfile",
  description:
    "Build — a branch whose only lockfile is Bun's: the checkout ran, the lockfile search found bun.lock and nothing was installed. The card names the package managers builds install with and links to publishing from CI.",
  relatedDocs: [
    "docs/protocol/cloud/viewer-builds.md",
    "docs/protocol/cloud/product-mockups-viewer.md",
    "docs/protocol/cloud/cloud-build-runner.md",
  ],
  tags: ["product", "folio", "viewer", "lockfile"],
  render: (_props, { viewport }) => (
    <ViewerBuildLockfileScreen viewport={viewport} />
  ),
});
