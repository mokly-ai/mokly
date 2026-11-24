import { SavedPropsPanel } from "../../../../../../../packages/ui/src/controls-panel/controls-panel.js";
import {
  PropValues,
  type PropValue,
} from "../../../../../../../packages/ui/src/props-panel/props-panel.js";
import { CONTROLS_COPY } from "../../../components/controls/parts/copy.js";
import {
  ACTION_SAVED,
  VariantControls,
  actionFields,
  type ActionValues,
} from "../../parts/component_props.js";

/** The Action's props in the order that its controls declare them. */
const ACTION_PROPS = ["label", "disabled", "radius", "tone", "hint"] as const;

/** A saved variant's props as the shipped list writes them, an unset one as Not set. */
function savedValues(values: ActionValues): PropValue[] {
  return ACTION_PROPS.map((name) => {
    const value = values[name];
    return {
      name,
      value: value === undefined ? CONTROLS_COPY.notSet : JSON.stringify(value),
    };
  });
}

/** The fields of the edit form of the Action's saved variant Default. */
const DEFAULT_FIELDS = actionFields(ACTION_SAVED.default);

/** The number of fields that Props counts while it edits Default. */
export const DEFAULT_FIELD_COUNT = DEFAULT_FIELDS.length;

/** The edit form of the Action's saved variant Default on Inspect. */
export function DefaultControls() {
  return (
    <VariantControls
      fields={DEFAULT_FIELDS}
      id="action-default"
      title="Default"
    />
  );
}

/** The saved props of the removed Compact, which set no hint. */
export const COMPACT_SAVED = {
  label: "Continue",
  disabled: false,
  radius: 4,
  tone: "primary",
} as const satisfies ActionValues;

/** The removed Compact's saved props: readable, with the reason, never editable. */
export function CompactSavedProps() {
  return (
    <SavedPropsPanel
      heading={CONTROLS_COPY.readonlyHeading}
      notice={CONTROLS_COPY.removed}
      title="Compact"
    >
      <PropValues values={savedValues(COMPACT_SAVED)} />
    </SavedPropsPanel>
  );
}
