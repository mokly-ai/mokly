import { defineScreen } from "@mokly/mokly";

import { ViewerStandaloneAccountScreen } from "../../../../screens/product/viewer/standalone-screen";

export default defineScreen({
  title: "Standalone · Named by address",
  description:
    "Standalone — long workspace and account labels stay on one desktop row with complete accessible names. The compact bar keeps the email's identifying local part.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
  ],
  tags: ["product", "folio", "viewer", "account"],
  render: (_props, { viewport }) => (
    <ViewerStandaloneAccountScreen viewport={viewport} />
  ),
});
