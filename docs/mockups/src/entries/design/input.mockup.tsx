import { defineComponent } from "@mokly/mokly";

import { inputInput } from "../../components/input";

const input = defineComponent(inputInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Input = input.Component;
export default input;
