import { defineScreen } from "@mokly/mokly";

import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";
import { SitePricingScreen } from "../../../screens/design/site/pricing_screen";

export default defineScreen({
  ...SITE_METADATA,
  description:
    "The pricing page of the open-source CLI and Mokly Cloud, with the plan facts of the billing contract.",
  relatedDocs: [...SITE_METADATA.relatedDocs, "docs/protocol/cloud/billing.md"],
  render: (_props, context) => (
    <SitePricingScreen viewport={context.viewport} />
  ),
  tags: ["site", "canvas"],
  title: "Pricing",
  useCasePaths: ["design/site/tour"],
});
