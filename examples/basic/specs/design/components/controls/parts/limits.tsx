import { SavedPropsPanel } from "../../../../../../../packages/ui/src/controls-panel/controls-panel.js";
import {
  PropsMessage,
  PropValues,
  type PropValue,
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

/** A component whose author declares no controls keeps its saved props read-only. */
export function ReadOnlyPanel({
  title,
  values,
}: {
  title: string;
  values: readonly PropValue[];
}) {
  return (
    <SavedPropsPanel
      heading={CONTROLS_COPY.readonlyHeading}
      notice={CONTROLS_COPY.readonlyProps}
      title={title}
    >
      <PropValues values={values} />
    </SavedPropsPanel>
  );
}

/** An entry without props or registered components has nothing to select. */
export function NoPropsPanel() {
  return <PropsMessage>{CONTROLS_COPY.noProps}</PropsMessage>;
}
