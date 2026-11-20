import { defineComponent } from "@mokly/mokly";

import { settingsDialogInput } from "../../components/settings-dialog";

const settingsDialog = defineComponent(settingsDialogInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const SettingsDialog = settingsDialog.Component;
export default settingsDialog;
