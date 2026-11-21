/**
 * The operation that a wait or a running write names, once, the same part the
 * catalogue draws from its own `placeholders.tsx`. Shown in a text place of
 * the layout, it takes that place's typography. For screen readers only, it is
 * a polite status, or, held in a text place such as a heading that waits as a
 * bar, part of that place's text: a status inside a heading would leave the
 * heading with no name.
 */
export function PendingName({
  label,
  hidden = false,
  inText = false,
}: {
  label: string;
  hidden?: boolean;
  /** Hidden inside a text place, as part of its text, not as a status. */
  inText?: boolean;
}) {
  return hidden ? (
    <span
      className="fo-pending-label fo-sr-only"
      role={inText ? undefined : "status"}
    >
      {label}…
    </span>
  ) : (
    <span className="fo-pending-label fo-wait-name">{label}…</span>
  );
}
