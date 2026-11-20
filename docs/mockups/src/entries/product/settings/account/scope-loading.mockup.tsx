import { defineScreen } from "@mokly/mokly";

import { SettingsAccountScopeLoadingScreen } from "../../../../screens/product/settings/account-pane";

export default defineScreen({
  title: "Account · Settings loading",
  description:
    "Account — asked for by its address while the settings scope loads: the rail draws the sections that the address's scope gives an owner, and the pane draws its own layout from the session, with the name waiting in its frame and Save changes, Disconnect GitHub and Sign out drawn disabled. Screen readers hear Loading settings. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "loading"],
  render: (_props, context) => (
    <SettingsAccountScopeLoadingScreen viewport={context.viewport} />
  ),
});
