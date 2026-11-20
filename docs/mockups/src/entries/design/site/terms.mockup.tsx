import { defineScreen } from "@mokly/mokly";

import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";
import { SiteTermsScreen } from "../../../screens/design/site/policy_screens";

export default defineScreen({
  ...SITE_METADATA,
  description:
    "The Terms of Service, with its effective date and legal-document navigation.",
  render: (_props, context) => <SiteTermsScreen viewport={context.viewport} />,
  tags: ["site", "folio"],
  title: "Terms of Service",
  useCasePaths: ["design/site/tour"],
});
