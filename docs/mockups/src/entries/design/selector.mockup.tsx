import { defineComponent } from "@mokly/mokly";

import { selectorInput } from "../../components/selector";

const selector = defineComponent(selectorInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Selector = selector.Component;
export default selector;
