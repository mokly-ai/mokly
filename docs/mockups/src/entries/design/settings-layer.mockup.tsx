import { defineComponent } from "@mokly/mokly";

import { settingsLayerInput } from "../../components/settings-layer";

const settingsLayer = defineComponent(settingsLayerInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const SettingsLayer = settingsLayer.Component;
export default settingsLayer;
