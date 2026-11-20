import { defineComponent } from "@mokly/mokly";

import { badgeInput } from "../../components/badge";

const badge = defineComponent(badgeInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const Badge = badge.Component;
export default badge;
