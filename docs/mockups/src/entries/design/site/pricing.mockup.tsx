import { defineScreen } from "@mokly/mokly";

import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";
import { SitePricingScreen } from "../../../screens/design/site/pricing_screen";

export default defineScreen({
  ...SITE_METADATA,
  description:
    "The pricing page: the open-source Mokly CLI, and the Free and Team plans of Mokly Cloud as frames in two section boxes with Team selected, then a props table that compares the plans and the resolved questions. The plan facts come from the billing contract and its plan gates. Create an account and Start a 7-day trial open the sign-up screen; Read Plans and billing draws without a link, because no mockup owns that documentation page.",
  relatedDocs: [
    ...SITE_METADATA.relatedDocs,
    "docs/protocol/cloud/billing.md",
    "docs/protocol/cloud/billing-plan-gates.md",
  ],
  render: (_props, context) => (
    <SitePricingScreen viewport={context.viewport} />
  ),
  tags: ["site", "canvas"],
  title: "Pricing",
  useCasePaths: ["design/site/tour"],
});
