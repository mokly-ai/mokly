import { defineScreen } from "@mokly/mokly";

import { SettingsAccountSessionLoadingScreen } from "../../../../screens/product/settings/account-pane";

export default defineScreen({
  title: "Account · Session loading",
  description:
    "Account — asked for by its address while the session loads, before the settings scope is read: the rail draws the sections that the address's scope gives an owner, and the pane draws its own layout with the name waiting in its frame, a bar for the email, and the GitHub connection in its most common form, connected, with its account, status and control as placeholders. Save changes and Sign out are drawn disabled. Screen readers hear Loading settings. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
    "docs/protocol/cloud/folio-chrome.md",
  ],
  tags: ["product", "folio", "settings", "loading"],
  render: (_props, context) => (
    <SettingsAccountSessionLoadingScreen viewport={context.viewport} />
  ),
});
