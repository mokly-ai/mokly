import { fieldChromeTokens, Input, inputSizeTokens } from "@firna/ui/input";
import { useSharedUiTheme } from "@firna/ui/theme";
import type { ReactNode } from "react";

import { useCompact } from "../layout/viewport";
import { TextBar } from "./placeholders";

/**
 * A label whose words hold a name the answer supplies, such as "Type Mokly
 * Cloud to confirm": the known words before and after the name, and the width
 * of the bar that waits in its place.
 */
type WaitingLabel = { before: string; bar: string; after: string };

/** What a field holds: the reader's value, or its waiting form. */
type FieldContent =
  | {
      label: string;
      value: string;
      onChange: (next: string) => void;
      waiting?: false;
      hold?: never;
    }
  | {
      /**
       * The field's waiting form while a read runs: its label and its own
       * frame, read only and out of the tab order, holding a bar where its
       * value would be, or `hold`, the wait's name, where this field is the
       * place that names it. A label whose words the answer completes waits
       * with them.
       */
      label: string | WaitingLabel;
      waiting: true;
      hold?: ReactNode;
      value?: never;
      onChange?: never;
    };

type FieldProps = FieldContent & {
  name: string;
  type?: "email" | "identifier" | "text";
  onFocus?: (value: string) => void;
  onBlur?: () => void;
  helper?: string;
  error?: string;
  disabled?: boolean;
  /**
   * A value the reader reads and copies rather than writes — a prepared link,
   * say. It stays focusable and selectable, because a control they cannot
   * reach is not one they can copy from.
   */
  readOnly?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
};

/**
 * What a waiting field holds where its value would be, in the frame's own
 * leading slot, so the frame sizes and places it. The slot is hidden from
 * assistive technology, so a name there describes the field instead.
 */
function waitingHold(
  id: string,
  hold: ReactNode,
  size: "md" | "lg",
): () => ReactNode {
  const sizing = inputSizeTokens(size);
  const held = (
    <span
      className="fo-wait-hold"
      id={hold === undefined ? undefined : id}
      style={{
        fontSize: sizing.inputFontSize,
        maxWidth: "calc(100cqw - " + (2 * sizing.paddingHorizontal + 2) + "px)",
      }}
    >
      {hold ?? <TextBar width="40cqw" />}
    </span>
  );
  return () => held;
}

/**
 * A field whose label waits for a name the answer supplies: the label row and
 * the frame that the package draws, from its own tokens and at its own gap,
 * with a bar between the label's known words. The label names the field,
 * which points at it by `id`.
 */
function WaitingLabelled({
  id,
  words,
  children,
}: {
  id: string;
  words: WaitingLabel;
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
        {words.before} <TextBar width={words.bar} /> {words.after}
      </span>
      {children}
    </div>
  );
}

/** A labelled field: the package Input, sized and configured by intent. */
export function Field(props: FieldProps) {
  const {
    label,
    name,
    type = "text",
    onFocus,
    onBlur,
    helper,
    error,
    disabled,
    readOnly,
    autoFocus,
    placeholder,
  } = props;
  const compact = useCompact();
  const size = compact ? "lg" : "md";
  const identifier = type === "identifier";
  const waits = props.waiting === true;
  const value = props.waiting ? "" : props.value;
  const describedBy = name + "-waiting";
  const labelWaits = typeof label === "string" ? undefined : label;
  const labelId = name + "-label";
  const field = (
    <Input
      nativeID={name}
      label={typeof label === "string" ? label : undefined}
      size={size}
      value={value}
      onChangeText={props.waiting ? undefined : props.onChange}
      onFocus={(event) => {
        const native = event.nativeEvent as typeof event.nativeEvent & {
          text?: string;
        };
        onFocus?.(native.text ?? value);
      }}
      onBlur={onBlur}
      keyboardType={type === "email" ? "email-address" : "default"}
      autoComplete={type === "email" ? "email" : "off"}
      {...(identifier
        ? {
            autoCapitalize: "none" as const,
            autoCorrect: false,
            spellCheck: false,
          }
        : {})}
      autoFocus={autoFocus}
      placeholder={waits ? undefined : placeholder}
      editable={!disabled && !readOnly && !waits}
      aria-disabled={Boolean(disabled)}
      aria-readonly={readOnly ? true : undefined}
      tabIndex={disabled || waits ? -1 : 0}
      {...(props.waiting
        ? { prefixIcon: waitingHold(describedBy, props.hold, size) }
        : {})}
      {...(props.waiting && props.hold !== undefined
        ? { "aria-describedby": describedBy }
        : {})}
      {...(labelWaits ? { "aria-labelledby": labelId } : {})}
      error={waits ? undefined : error}
      hint={error && !waits ? undefined : helper}
      testID={"field-" + name}
    />
  );
  return (
    <div className={waits ? "field-layout fo-wait-input" : "field-layout"}>
      {labelWaits ? (
        <WaitingLabelled id={labelId} words={labelWaits}>
          {field}
        </WaitingLabelled>
      ) : (
        field
      )}
    </div>
  );
}
