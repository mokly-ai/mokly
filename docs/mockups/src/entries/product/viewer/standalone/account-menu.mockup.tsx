import { defineScreen } from "@mokly/mokly";

import { ViewerAccountMenuScreen } from "../../../../screens/product/viewer/account-menu-screen";

export default defineScreen({
  title: "Standalone · Account menu",
  description:
    "Standalone — the account menu open under the avatar: who is signed in, Theme with Light and Dark, Settings, Docs, Changelog and Sign out. Settings opens the settings dialog on its index, over the viewer. Docs and Changelog carry the external glyph, because each opens a site page: in the same tab in a browser, and in the system browser from the desktop app. A narrow bar opens More under its trigger instead, with the project, History and Share above the same account rows, and a phone opens More as a bottom sheet whose rows are 44px touch targets.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/viewer-chrome.md",
    "docs/protocol/cloud/viewer-chrome-account.md",
    "docs/protocol/cloud/marketing-site.md",
  ],
  tags: ["product", "canvas", "viewer", "menu"],
  render: (_props, { viewport }) => (
    <ViewerAccountMenuScreen viewport={viewport} />
  ),
});
