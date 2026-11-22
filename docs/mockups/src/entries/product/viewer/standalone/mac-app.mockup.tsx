import { defineScreen } from "@mokly/mokly";

import { ViewerStandaloneMacAppScreen } from "../../../../screens/product/viewer/mac-app-screen";

export default defineScreen({
  title: "Standalone · Mac app",
  description:
    "Standalone — the ready viewer in the Mac app, whose window has no title bar. The window buttons sit at the start of the top bar, and the cloud controls start after them. The desktop view is a wide window; the mobile view is a narrow window with the compact bar.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/desktop-bundle.md",
    "docs/protocol/cloud/viewer-chrome.md",
  ],
  tags: ["product", "folio", "viewer", "mac-app"],
  render: (_props, { viewport }) => (
    <ViewerStandaloneMacAppScreen viewport={viewport} />
  ),
});
