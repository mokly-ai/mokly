import { defineScreen } from "@mokly/mokly";

import { SiteDownloadScreen } from "../../../screens/design/site/download_screen";
import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";

export default defineScreen({
  ...SITE_METADATA,
  description:
    "The download page of the desktop app, which the home's Download for Mac opens: the installers for Mac and Linux as frames in two section boxes, Apple silicon first. Each frame is labelled with its file and opens GitHub's fixed address of that file in the latest release, so the page names no version and no release status. The file names come from the desktop distribution contract. No frame is selected, because the page does not detect the reader's computer.",
  relatedDocs: [
    ...SITE_METADATA.relatedDocs,
    "docs/protocol/cloud/desktop-distribution.md",
  ],
  render: (_props, context) => (
    <SiteDownloadScreen viewport={context.viewport} />
  ),
  tags: ["site", "canvas"],
  title: "Download",
  useCasePaths: ["design/site/tour"],
});
