import { defineComponent } from "@mokly/mokly";

import { windowControlsInput } from "../../components/window-controls";

const windowControls = defineComponent(windowControlsInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const WindowControls = windowControls.Component;
export default windowControls;
