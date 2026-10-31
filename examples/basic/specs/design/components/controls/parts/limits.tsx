import { SavedPropsPanel } from "../../../../../../../packages/ui/src/controls-panel/controls-panel.js";
import {
  PropsMessage,
  PropValues,
} from "../../../../../../../packages/ui/src/props-panel/props-panel.js";
import { actionCompact, ActionPropValues } from "../../parts/action_props.js";

import { CONTROLS_COPY } from "./copy.js";

/** A removed saved variant keeps its saved props readable. */
export function RemovedPanel() {
  return (
    <SavedPropsPanel
      heading={CONTROLS_COPY.readonlyHeading}
      notice={CONTROLS_COPY.removed}
      title={actionCompact.title}
    >
      <ActionPropValues props={actionCompact.props} />
    </SavedPropsPanel>
  );
}

/** Badge's author declares no controls, so its saved props are read-only. */
export function ReadOnlyPanel() {
  return (
    <SavedPropsPanel
      heading={CONTROLS_COPY.readonlyHeading}
      notice={CONTROLS_COPY.readonlyProps}
      title="Badge"
    >
      <PropValues values={[{ name: "label", value: '"New"' }]} />
    </SavedPropsPanel>
  );
}

/** An entry without props or registered components has nothing to select. */
export function NoPropsPanel() {
  return <PropsMessage>{CONTROLS_COPY.noProps}</PropsMessage>;
}
