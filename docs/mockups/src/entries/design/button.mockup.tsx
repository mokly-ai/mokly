import { defineComponent } from "@mokly/mokly";

import { buttonInput } from "../../components/button";

const button = defineComponent(buttonInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Button = button.Component;
export default button;
