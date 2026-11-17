import { defineComponent } from "@mokly/mokly";

import { segmentedInput } from "../../components/segmented";

const segmented = defineComponent(segmentedInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Segmented = segmented.Component;
export default segmented;
