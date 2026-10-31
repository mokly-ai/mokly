import { PropFieldFrame } from "../../../../../../packages/ui/src/prop-field/prop-field.js";
import { CONTROLS_COPY } from "../../components/controls/parts/copy.js";

import type { PropFieldProps } from "./prop-field.js";

/**
 * The shipped prop field around the native control that the caller's slot
 * holds. An optional field draws the Set check box and the Not set line.
 */
export function PropFieldView({
  label,
  inputId,
  description,
  error,
  optional,
  supplied,
  control,
}: PropFieldProps) {
  return (
    <PropFieldFrame
      description={description ?? ""}
      disabled={false}
      error={error}
      id={inputId}
      input={control}
      label={label}
      optional={optional}
      supplied={supplied}
      wording={{
        notSet: CONTROLS_COPY.notSet,
        optional: CONTROLS_COPY.optional,
        set: CONTROLS_COPY.set(label),
      }}
    />
  );
}
