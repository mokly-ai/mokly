import { defineScreen } from "@mokly/mokly";

import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";
import { SitePrivacyScreen } from "../../../screens/design/site/policy_screens";

export default defineScreen({
  ...SITE_METADATA,
  description:
    "The Privacy Policy, with its effective date and legal-document navigation.",
  render: (_props, context) => (
    <SitePrivacyScreen viewport={context.viewport} />
  ),
  tags: ["site", "folio"],
  title: "Privacy Policy",
  useCasePaths: ["design/site/tour"],
});
