import { defineComponent } from "@mokly/mokly";

import { writeFailureInput } from "../../components/write-failure";

const writeFailure = defineComponent(writeFailureInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const WriteFailure = writeFailure.Component;
export default writeFailure;
