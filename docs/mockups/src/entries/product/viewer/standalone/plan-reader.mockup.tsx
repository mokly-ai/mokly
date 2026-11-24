import { defineScreen } from "@mokly/mokly";

import { ViewerStandalonePlanReaderScreen } from "../../../../screens/product/viewer/standalone-screen";

export default defineScreen({
  title: "Standalone · Private on the free plan, as a reader",
  description:
    "Standalone — the same private project on the free plan, read by everyone who cannot open billing themselves: the card says what they can do instead and offers the switcher.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-plan-gates.md",
  ],
  tags: ["product", "canvas", "viewer", "plan-reader"],
  render: (_props, { viewport }) => (
    <ViewerStandalonePlanReaderScreen viewport={viewport} />
  ),
});
