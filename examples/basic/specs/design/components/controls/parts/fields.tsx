import { optional, useDesignInstance } from "../../../library/composition.js";
import { propField } from "../../../library/inspector/prop-field.js";
import type { ActionProps } from "../../parts/action_props.js";

import { CONTROLS_COPY } from "./copy.js";

/** The screen supplies actual inputs and values; the component owns field framing. */
export function ControlFields({
  props,
  invalid,
  idPrefix = "action",
}: {
  props: ActionProps;
  invalid: boolean;
  idPrefix?: string;
}) {
  const scope = useDesignInstance(idPrefix);
  const id = (field: string) => idPrefix + "-" + field;
  return (
    <div className="ce-control-fields">
      <propField.Component
        moklyInstance={scope + "-label"}
        label="label"
        inputId={id("label")}
        optional={false}
        supplied
        control={
          <input id={id("label")} type="text" defaultValue={props.label} />
        }
      />
      <propField.Component
        moklyInstance={scope + "-disabled"}
        label="disabled"
        inputId={id("disabled")}
        optional={false}
        supplied
        control={
          <div className="ce-check-value">
            <input
              id={id("disabled")}
              type="checkbox"
              defaultChecked={props.disabled}
            />
          </div>
        }
      />
      <propField.Component
        moklyInstance={scope + "-radius"}
        label="cornerRadius"
        inputId={id("radius")}
        optional={false}
        supplied
        {...optional(
          "description",
          invalid ? undefined : CONTROLS_COPY.range(0, 24, 1),
        )}
        {...optional(
          "error",
          invalid ? CONTROLS_COPY.numberError(0, 24, 1) : undefined,
        )}
        control={
          <input
            id={id("radius")}
            type="number"
            min={0}
            max={24}
            step={1}
            defaultValue={props.cornerRadius}
            aria-invalid={invalid ? "true" : undefined}
            aria-describedby={
              id("radius") + (invalid ? "-error" : "-description")
            }
          />
        }
      />
      <propField.Component
        moklyInstance={scope + "-emphasis"}
        label="emphasis"
        inputId={id("emphasis")}
        optional={false}
        supplied
        control={
          <select id={id("emphasis")} defaultValue={props.emphasis}>
            <option value="strong">Strong</option>
            <option value="quiet">Quiet</option>
          </select>
        }
      />
      <propField.Component
        moklyInstance={scope + "-hint"}
        label="hint"
        inputId={id("hint")}
        optional
        supplied={props.hint !== undefined}
        control={
          <div>
            <label className="ce-check-value">
              <input
                type="checkbox"
                defaultChecked={props.hint !== undefined}
              />
              <span>{CONTROLS_COPY.set("hint")}</span>
            </label>
            <input
              className="ce-hint-value"
              id={id("hint")}
              type="text"
              defaultValue={props.hint ?? ""}
            />
            <p className="ce-unset-value">{CONTROLS_COPY.notSet}</p>
          </div>
        }
      />
    </div>
  );
}
