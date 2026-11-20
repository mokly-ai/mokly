import { defineScreen } from "@mokly/mokly";

import { SettingsMembersScopeLoadingScreen } from "../../../../screens/product/settings/members-pane";

export default defineScreen({
  title: "Members · Settings loading",
  description:
    "Members — asked for by its address while the settings scope loads: the rail draws the sections that the address's scope gives an owner, the pane draws its own wait, and each heading that names the workspace keeps its known words beside a bar for the name. Screen readers hear Loading settings. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "loading"],
  render: (_props, context) => (
    <SettingsMembersScopeLoadingScreen viewport={context.viewport} />
  ),
});
