import { defineComponent } from "@mokly/mokly";

import { statusDotInput } from "../../components/status-dot";

const statusDot = defineComponent(statusDotInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const StatusDot = statusDot.Component;
export default statusDot;
