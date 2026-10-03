import { useDesignStyle } from "../style_context.js";

import type { PropFieldProps } from "./prop-field.js";

export function PropFieldView({
  label,
  inputId,
  description,
  error,
  optional,
  control,
}: PropFieldProps) {
  useDesignStyle("prop-field");
  return (
    <div
      className={
        optional ? "ce-control-row ce-optional-control" : "ce-control-row"
      }
    >
      <label htmlFor={inputId}>
        {label}
        {optional ? (
          <>
            {" "}
            <span aria-hidden="true">Optional</span>
          </>
        ) : null}
      </label>
      {description || error ? (
        <div>
          {control}
          {description && !error ? (
            <span className="ce-control-hint" id={`${inputId}-description`}>
              {description}
            </span>
          ) : null}
          {error ? (
            <p className="ce-field-error" id={`${inputId}-error`}>
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        control
      )}
    </div>
  );
}
