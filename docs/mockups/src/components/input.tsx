import { fieldChromeTokens, Input, inputSizeTokens } from "@firna/ui/input";
import { useSharedUiTheme } from "@firna/ui/theme";
import type { ReactNode } from "react";

import { fieldRefusals } from "../fixtures/product-states";
import { TextBar } from "../screens/product/placeholders";
import { componentInput, componentMetadata } from "./metadata";
import { staticNoop } from "./static-controls";

/**
 * A waiting field whose label holds a name the answer supplies: the label row
 * and the frame that the package draws, from its own tokens and at its own
 * gap, with a bar between the label's known words. The label names the field,
 * which points at it by `id`.
 */
function WaitingLabelled({
  id,
  before,
  bar,
  after,
  children,
}: {
  id: string;
  before: string;
  bar: string;
  after: string;
  children: ReactNode;
}) {
  const { field, fieldLabel } = fieldChromeTokens(useSharedUiTheme());
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: field.gap }}>
      <span
        id={id}
        style={{
          color: fieldLabel.color,
          fontFamily: fieldLabel.fontFamily,
          fontSize: fieldLabel.fontSize,
          fontWeight: fieldLabel.fontWeight,
          lineHeight: fieldLabel.lineHeight + "px",
        }}
      >
        {before} <TextBar width={bar} /> {after}
      </span>
      {children}
    </div>
  );
}

export const inputInput = componentInput({
  ...componentMetadata(
    "Input",
    "A labelled field with accessible help and recovery.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label", "name", "type"],
    properties: {
      label: { type: "string" },
      name: { type: "string" },
      type: { enum: ["email", "text", "identifier"] },
      value: { type: "string" },
      placeholder: { type: "string" },
      helper: { type: "string" },
      error: { type: "string" },
      disabled: { type: "boolean" },
      /**
       * The field's waiting form while a read runs: its label and its own
       * frame, read only, holding a bar where its value would be, or the
       * `hold` slot, the wait's name where this field is the place that
       * names it.
       */
      waiting: { type: "boolean" },
      /**
       * A waiting label whose words hold a name the answer supplies, such as
       * "Type Mokly Cloud to confirm": `label` gives the words before the
       * name, a bar `bar` wide stands in its place, and `after` follows it.
       */
      labelWaits: {
        type: "object",
        additionalProperties: false,
        required: ["bar", "after"],
        properties: { bar: { type: "string" }, after: { type: "string" } },
      },
    },
  },
  props: { label: "Email", name: "email", type: "email" },
  slots: ["hold"],
  controls: {
    label: { kind: "text" },
    value: { kind: "text" },
    placeholder: { kind: "text" },
    helper: { kind: "text" },
    error: { kind: "text" },
    disabled: { kind: "boolean" },
    type: {
      kind: "select",
      options: [
        { label: "Email", value: "email" },
        { label: "Text", value: "text" },
        { label: "Identifier", value: "identifier" },
      ],
    },
    waiting: { kind: "boolean" },
  },
  render: (
    {
      label,
      name,
      type,
      value,
      placeholder,
      helper,
      error,
      disabled,
      waiting,
      labelWaits,
      hold,
    },
    { viewport },
  ) => {
    const identifier = type === "identifier";
    const size = viewport === "mobile" ? "lg" : "md";
    const waits = waiting === true;
    const named = waits && hold !== undefined;
    // Only a waiting field's label waits; at rest the label is whole.
    const labelWaiting = waits ? labelWaits : undefined;
    const labelId = name + "-label";
    const sizing = inputSizeTokens(size);
    // What the waiting frame holds goes in the package's own leading slot, so
    // the frame sizes and places it. The slot is hidden from assistive
    // technology, so a name there describes the field instead.
    const holding = (
      <span
        className="fo-wait-hold"
        id={named ? name + "-waiting" : undefined}
        style={{
          fontSize: sizing.inputFontSize,
          maxWidth:
            "calc(100cqw - " + (2 * sizing.paddingHorizontal + 2) + "px)",
        }}
      >
        {named ? hold : <TextBar width="40cqw" />}
      </span>
    );
    const field = (
      <Input
        nativeID={name}
        label={labelWaiting ? undefined : label}
        size={size}
        value={waits ? "" : value}
        onChangeText={staticNoop}
        keyboardType={type === "email" ? "email-address" : "default"}
        autoComplete={type === "email" ? "email" : "off"}
        {...(identifier
          ? {
              autoCapitalize: "none" as const,
              autoCorrect: false,
              spellCheck: false,
            }
          : {})}
        placeholder={waits ? undefined : placeholder}
        editable={!disabled && !waits}
        aria-disabled={Boolean(disabled)}
        tabIndex={disabled || waits ? -1 : 0}
        {...(waits ? { prefixIcon: () => holding } : {})}
        {...(named ? { "aria-describedby": name + "-waiting" } : {})}
        {...(labelWaiting ? { "aria-labelledby": labelId } : {})}
        error={waits ? undefined : error}
        hint={error && !waits ? undefined : helper}
        testID="firna-input"
      />
    );
    return (
      <div className={waits ? "field-layout fo-wait-input" : "field-layout"}>
        {labelWaiting ? (
          <WaitingLabelled
            id={labelId}
            before={label}
            bar={labelWaiting.bar}
            after={labelWaiting.after}
          >
            {field}
          </WaitingLabelled>
        ) : (
          field
        )}
      </div>
    );
  },
  variants: [
    {
      slug: "empty",
      title: "Empty",
      props: {
        label: "Email",
        name: "empty-email",
        type: "email",
        placeholder: "sam@example.com",
      },
    },
    {
      slug: "filled",
      title: "Filled",
      props: {
        label: "Email",
        name: "filled-email",
        type: "email",
        value: "sam@example.com",
      },
    },
    {
      slug: "invalid",
      title: "Invalid",
      props: {
        label: "Email",
        name: "invalid-email",
        type: "email",
        value: "sam@",
        error: fieldRefusals.email,
      },
    },
    {
      slug: "disabled",
      title: "Disabled",
      props: {
        label: "Email",
        name: "disabled-email",
        type: "email",
        value: "sam@example.com",
        disabled: true,
      },
    },
    {
      slug: "waiting",
      title: "Waiting",
      props: {
        label: "Email",
        name: "waiting-email",
        type: "email",
        waiting: true,
      },
    },
  ],
});
