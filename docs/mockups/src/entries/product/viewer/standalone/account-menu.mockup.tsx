import { defineScreen } from "@mokly/mokly";

import { ViewerAccountMenuScreen } from "../../../../screens/product/viewer/account-menu-screen";

export default defineScreen({
  title: "Standalone · Account menu",
  description:
    "Standalone — the account menu open under the avatar: who is signed in, Theme with Light and Dark, Settings and Sign out. Settings opens the settings dialog on its index, over the viewer. A narrow bar opens More under its trigger instead, with the project, History and Share above the same account rows, and a phone opens More as a bottom sheet whose rows are 44px touch targets.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/viewer-chrome.md",
  ],
  tags: ["product", "canvas", "viewer", "menu"],
  render: (_props, { viewport }) => (
    <ViewerAccountMenuScreen viewport={viewport} />
  ),
});
