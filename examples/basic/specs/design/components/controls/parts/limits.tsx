import { PropsMessage } from "../../../../../../../packages/ui/src/props-panel/props-panel.js";

import { CONTROLS_COPY } from "./copy.js";

/** An entry without props or registered components has nothing to select. */
export function NoPropsPanel() {
  return <PropsMessage>{CONTROLS_COPY.noProps}</PropsMessage>;
}
