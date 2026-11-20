import { sample } from "../../../fixtures/product";
import { Action } from "../page-parts";

/** The drawing of the open account menu, which the avatar and More open. */
export const accountMenuPath = "product/viewer/standalone/account-menu";

/**
 * What the bar calls the reader, and the initials of the avatar that stands
 * for them. Every account is created by an email address, so somebody who
 * has not set a name is named by theirs. The whole name or address stays the
 * avatar's accessible name and its tooltip.
 */
export interface AccountLabel {
  label: string;
  /** The whole value, when the label is a shortened form of it. */
  whole?: string;
  initials: string;
}

/** A reader who has set a display name: called by it, with its initials. */
export function namedReader(person: {
  name: string;
  initials: string;
}): AccountLabel {
  return { label: person.name, initials: person.initials };
}

/** Cal, the reader of every viewer drawing unless one names somebody else. */
export const defaultReader = namedReader(sample.viewer);

/**
 * A reader with no display name, called by their address. A compact label
 * keeps the local part that identifies them, and the whole address stays the
 * accessible name. The initials take the first letter of the first two words
 * of the local part, as `jordan.mccallister` gives `JM`.
 */
export function addressReader(email: string, compact: boolean): AccountLabel {
  const local = email.split("@")[0] ?? email;
  const initials = local
    .split(/[^a-z]+/i)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return { label: compact ? local : email, whole: email, initials };
}

/**
 * The reader's avatar: a circle in the signed-in person's colour of the
 * Canvas palette, with their initials. It is a picture, so assistive
 * technology skips it; whatever it stands beside names the reader.
 */
export function ReaderAvatar({
  initials,
  large = false,
}: {
  initials: string;
  /** The menu's identity row draws it larger than the bar. */
  large?: boolean;
}) {
  return (
    <span
      className={
        large ? "fo-canvas-avatar fo-canvas-avatar-large" : "fo-canvas-avatar"
      }
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/**
 * The full bar's account control: the reader's avatar, which opens the
 * account menu. The registered Button is the control, so its own text is the
 * reader's label and its accessible name is the whole name or address. The
 * avatar is a decorative picture laid over the Button, so the initials are
 * never the Button's text: the control keeps the name that a screen reader
 * announces and that the parity check reads, and the initials stay out of
 * the accessibility tree. While the route reads the project the control is
 * disabled and its avatar fades with it.
 */
export function AccountTrigger({
  account,
  to,
  disabled = false,
}: {
  account: AccountLabel;
  /** The catalogue entry the avatar opens. A published slot opens none. */
  to?: string;
  disabled?: boolean;
}) {
  const whole = account.whole ?? account.label;
  return (
    <span
      className={
        disabled
          ? "fo-canvas-account fo-canvas-account-off"
          : "fo-canvas-account"
      }
      title={whole}
    >
      <Action
        instance="viewer-account"
        label={account.label}
        whole={whole}
        tone="quiet"
        size="sm"
        block
        singleLine
        to={to}
        disabled={disabled}
      />
      <ReaderAvatar initials={account.initials} />
    </span>
  );
}
