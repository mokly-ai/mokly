import { defineScreen } from "@mokly/mokly";

import { ViewerStandaloneUnreadableScreen } from "../../../../screens/product/viewer/standalone-screen";

export default defineScreen({
  title: "Standalone · Couldn’t load",
  description:
    "Standalone — the read that would have produced the publication failed. The address named one, so the stage says so rather than naming the project, and asking again is the one thing on offer; the chrome has no reference to show, because resolving it is what did not happen.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
  ],
  tags: ["product", "folio", "viewer", "unreadable"],
  render: (_props, { viewport }) => (
    <ViewerStandaloneUnreadableScreen viewport={viewport} />
  ),
});
