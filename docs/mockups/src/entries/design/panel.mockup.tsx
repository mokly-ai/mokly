import { defineComponent } from "@mokly/mokly";

import { panelInput } from "../../components/panel";

const panel = defineComponent(panelInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Panel = panel.Component;
export default panel;
