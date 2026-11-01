import { ControlsPanel } from "../../../../../../../packages/ui/src/controls-panel/controls-panel.js";
import { PropFields } from "../../../../../../../packages/ui/src/prop-field/prop-field.js";
import { useDesignInstance } from "../../../library/composition.js";
import { propField } from "../../../library/inspector/prop-field.js";

import { CONTROLS_COPY } from "./copy.js";

/**
 * Welcome's own props in the Props tab while no component is selected, in the
 * shipped edit form. The example screen declares one boolean prop for its
 * empty workspace state.
 */
export function ScreenControls() {
  const scope = useDesignInstance("welcome");
  return (
    <ControlsPanel
      dirty={false}
      title="Welcome"
      wording={{
        edited: CONTROLS_COPY.edited,
        heading: CONTROLS_COPY.heading,
        reset: CONTROLS_COPY.reset("Welcome"),
        saved: CONTROLS_COPY.saved,
      }}
    >
      <PropFields>
        <propField.Component
          moklyInstance={scope + "-empty"}
          label="Empty workspace"
          inputId="welcome-empty"
          optional={false}
          supplied
          control={<input id="welcome-empty" type="checkbox" />}
        />
      </PropFields>
    </ControlsPanel>
  );
}
