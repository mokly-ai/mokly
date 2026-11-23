import { Action } from "../components/action";

import { Slot } from "./chrome";
import type { BarPress } from "./chrome";

/**
 * The initials of the reader's avatar: the first letters of the first two
 * words of their name or, for a reader named by their address, of the
 * address's local part, as `jordan.mccallister` gives `JM`.
 */
export function readerInitials(name: string): string {
  const at = name.indexOf("@");
  const words = (at > 0 ? name.slice(0, at) : name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
  const initials = words
    .slice(0, 2)
    .map((word) => (Array.from(word)[0] ?? "").toUpperCase())
    .join("");
  return initials || "?";
}

/**
 * The full bar's account control, as the catalogue draws it: the reader's
 * avatar laid over the quiet registered Button that is the control. The
 * Button's own text is what the bar calls the reader, and its accessible name
 * and tooltip are the whole name or address, so the initials stay a picture
 * that assistive technology skips. It opens the Account settings pane. While
 * the route reads the project it keeps its label, draws itself disabled and
 * fades its avatar.
 */
export function AccountTrigger({
  label,
  whole,
  testID,
  onPress,
  open,
  disabled,
  slotRef,
  waiting,
}: BarPress & {
  /** What the bar calls the reader. */
  label: string;
  /** The whole name or address, when the label is a shortened form of it. */
  whole?: string;
}) {
  const name = whole ?? label;
  return (
    <Slot name="account" slotRef={slotRef} className="fo-top-fixed">
      <span
        className={
          waiting
            ? "fo-canvas-account fo-canvas-account-off"
            : "fo-canvas-account"
        }
        title={name}
      >
        <Action
          label={label}
          accessibilityLabel={name}
          tone="quiet"
          size="sm"
          block
          singleLine
          expanded={open}
          hasPopup="dialog"
          disabled={waiting === true || disabled}
          onPress={onPress}
          testID={testID}
        />
        <span className="fo-canvas-avatar" aria-hidden="true">
          {readerInitials(name)}
        </span>
      </span>
    </Slot>
  );
}
