import { Action } from "../components/action";

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
 * The reader's avatar: their initials in a circle in the signed-in person's
 * colour. It is a picture, so assistive technology skips it; whatever it
 * stands beside names the reader. The account menu draws it larger than the
 * bar.
 */
export function ReaderAvatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  return (
    <span
      className={
        large ? "fo-canvas-avatar fo-canvas-avatar-large" : "fo-canvas-avatar"
      }
      aria-hidden="true"
    >
      {readerInitials(name)}
    </span>
  );
}

/**
 * The full bar's account control, as the catalogue draws it: the reader's
 * avatar laid over the quiet registered Button that is the control. The
 * Button's own text, its accessible name and its tooltip are the reader's
 * whole name, or their whole address when they have set none, so the
 * initials stay a picture that assistive technology skips. It opens the
 * account menu, so it announces a menu and whether that menu is open. While
 * the route reads the project it keeps its label, draws itself disabled and
 * fades its avatar.
 */
export function AccountTrigger({
  name,
  open = false,
  onPress,
  waiting = false,
  testID,
}: {
  /** The reader's whole name, or their whole address. */
  name: string;
  open?: boolean;
  onPress?: () => void;
  waiting?: boolean;
  testID?: string;
}) {
  return (
    <span
      className={
        waiting
          ? "fo-canvas-account fo-canvas-account-off"
          : "fo-canvas-account"
      }
      title={name}
    >
      <Action
        label={name}
        accessibilityLabel={name}
        tone="quiet"
        size="sm"
        block
        singleLine
        expanded={open}
        hasPopup="menu"
        disabled={waiting}
        onPress={onPress}
        testID={testID}
      />
      <ReaderAvatar name={name} />
    </span>
  );
}
