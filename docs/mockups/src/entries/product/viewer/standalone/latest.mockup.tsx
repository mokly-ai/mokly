import { defineScreen } from "@mokly/mokly";

import { ViewerStandaloneLatestScreen } from "../../../../screens/product/viewer/standalone-screen";

export default defineScreen({
  title: "Standalone · View latest",
  description:
    "Standalone — a newer publication has arrived on this branch. The reader keeps the one they are reading and the chrome offers the way to the new one; nothing moves on its own.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
  ],
  tags: ["product", "folio", "viewer", "latest"],
  render: (_props, { viewport }) => (
    <ViewerStandaloneLatestScreen viewport={viewport} />
  ),
});
