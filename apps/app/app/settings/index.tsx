import { SettingsRoute } from "../../src/settings/layer-screen";

/** The settings index; on a wide surface it opens the dialog instead. */
export default function SettingsIndex() {
  return <SettingsRoute pane="sections" />;
}
