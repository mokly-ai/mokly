import { defineScreen } from "@mokly/mokly";

import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";
import { SiteComplaintsScreen } from "../../../screens/design/site/policy_screens";

export default defineScreen({
  ...SITE_METADATA,
  description:
    "The complaints process, with its effective date and legal-document navigation.",
  render: (_props, context) => (
    <SiteComplaintsScreen viewport={context.viewport} />
  ),
  tags: ["site", "folio"],
  title: "Complaints",
  useCasePaths: ["design/site/tour"],
});
