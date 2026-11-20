import { defineScreen } from "@mokly/mokly";

import { ViewerStandalonePlanScreen } from "../../../../screens/product/viewer/standalone-screen";

export default defineScreen({
  title: "Standalone · Private on the free plan",
  description:
    "Standalone — a private project on the free plan, which takes no new publication. The stage offers an owner the way to Billing, and the branch beside it may still hold a publication this project kept.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-plan-gates.md",
  ],
  tags: ["product", "canvas", "viewer", "plan"],
  render: (_props, { viewport }) => (
    <ViewerStandalonePlanScreen viewport={viewport} />
  ),
});
