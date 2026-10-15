import { useDesignInstance } from "../../../library/composition.js";
import { propField } from "../../../library/inspector/prop-field.js";

import { CONTROLS_COPY } from "./copy.js";

/**
 * Welcome's own props in the Props tab while no component is selected. The
 * example screen declares one boolean prop for its empty workspace state.
 */
export function ScreenControls() {
  const scope = useDesignInstance("welcome");
  return (
    <section className="ce-controls-content">
      <div className="ce-controls-heading">
        <div>
          <h3>{CONTROLS_COPY.heading}</h3>
          <p>Welcome · {CONTROLS_COPY.saved}</p>
        </div>
        <button className="ce-reset" type="button" disabled>
          {CONTROLS_COPY.reset("Welcome")}
        </button>
      </div>
      <div className="ce-control-fields">
        <propField.Component
          moklyInstance={scope + "-empty"}
          label="Empty workspace"
          inputId="welcome-empty"
          optional={false}
          supplied
          control={
            <div className="ce-check-value">
              <input id="welcome-empty" type="checkbox" />
            </div>
          }
        />
      </div>
    </section>
  );
}
