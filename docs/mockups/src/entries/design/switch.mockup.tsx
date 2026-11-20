import { defineComponent } from "@mokly/mokly";

import { switchInput } from "../../components/switch";

const switchControl = defineComponent(switchInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Switch = switchControl.Component;
export default switchControl;
