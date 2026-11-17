import { defineScreen } from "@mokly/mokly";

import { SiteChangelogScreen } from "../../../screens/design/site/changelog_screen";
import { RELEASES } from "../../../screens/design/site/parts/releases";
import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";

export default defineScreen({
  ...SITE_METADATA,
  description: `The installed Mokly ${RELEASES[0].version} through ${RELEASES[RELEASES.length - 1].version} release facts rendered as the site changelog.`,
  render: (_props, context) => (
    <SiteChangelogScreen viewport={context.viewport} />
  ),
  tags: ["site", "folio"],
  title: "Changelog",
  useCasePaths: ["design/site/tour"],
});
