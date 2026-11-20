import { defineScreen } from "@mokly/mokly";

import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";
import { SiteSecurityScreen } from "../../../screens/design/site/policy_screens";

export default defineScreen({
  ...SITE_METADATA,
  description:
    "The security summary, with its effective date and legal-document navigation.",
  render: (_props, context) => (
    <SiteSecurityScreen viewport={context.viewport} />
  ),
  tags: ["site", "folio"],
  title: "Security",
  useCasePaths: ["design/site/tour"],
});
