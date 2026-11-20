import { defineScreen } from "@mokly/mokly";

import { SiteDocsScreen } from "../../../screens/design/site/docs_screen";
import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";

export default defineScreen({
  ...SITE_METADATA,
  description:
    "Documentation with search, section tree, install command, on-this-page navigation and pagination.",
  render: (_props, context) => <SiteDocsScreen viewport={context.viewport} />,
  tags: ["site", "canvas"],
  title: "Documentation",
  useCasePaths: ["design/site/tour"],
});
