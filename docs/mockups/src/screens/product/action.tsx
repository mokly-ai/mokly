import { MockLink } from "@mokly/mokly";

import type { ButtonIcon } from "../../components/button";
import { HeldTooltip } from "../../components/button-parts";
import { Button } from "../../entries/design/button.mockup";

import { PendingName } from "./placeholders";

/** Navigation keeps the registered Button's geometry and source attribution. */
export function Action({
  label,
  instance,
  to,
  tone = "secondary",
  disabled = false,
  busy,
  icon,
  chevron,
  size,
  block,
  singleLine,
  whole,
  lead,
  iconOnly,
}: {
  label: string;
  /**
   * The whole value, when the label is a shortened form of it. It becomes the
   * control's accessible name, so a reader who cannot hover — which is every
   * reader on the surface where a label is shortened — still reaches it.
   */
  whole?: string;
  /** A muted lead the registered Button draws before the label. */
  lead?: string;
  instance?: string;
  to?: string;
  tone?: "primary" | "secondary" | "quiet" | "danger";
  disabled?: boolean;
  /**
   * The operation this control's write runs, while it runs. The control keeps
   * its place with the busy spinner, `label` is its working word, and a screen
   * reader hears the operation; the form around it inserts nothing.
   */
  busy?: string;
  icon?: ButtonIcon;
  iconOnly?: boolean;
  chevron?: boolean;
  size?: "sm" | "md" | "lg";
  block?: boolean;
  /** Keep a constrained chrome label on one ellipsized line. */
  singleLine?: boolean;
}) {
  // The registered Button refuses an `undefined` prop value, so each optional
  // prop reaches it only when the caller gave it one.
  const optional = {
    ...(whole === undefined ? {} : { accessibilityLabel: whole }),
    ...(busy === undefined ? {} : { busy: true }),
    ...(icon === undefined ? {} : { icon }),
    ...(iconOnly === undefined ? {} : { iconOnly }),
    ...(chevron === undefined ? {} : { chevron }),
    ...(size === undefined ? {} : { size }),
    ...(block === undefined ? {} : { block }),
    ...(singleLine === undefined ? {} : { singleLine }),
    ...(lead === undefined ? {} : { lead }),
  };
  const control = (
    <Button
      moklyInstance={
        instance ??
        label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      }
      label={label}
      tone={tone}
      disabled={disabled}
      {...optional}
    />
  );
  // A busy control refuses the press, so it leads nowhere while it works.
  if (busy !== undefined)
    return (
      <>
        {control}
        <PendingName label={busy} hidden />
      </>
    );
  if (!to || disabled) return control;
  const linked = (
    <MockLink asChild to={to}>
      {control}
    </MockLink>
  );
  // A link takes the control itself as its child, so an icon-only control's
  // tooltip holder goes around the link, and the Button draws none.
  return iconOnly ? (
    <span style={{ display: "contents" }} title={whole ?? label}>
      <HeldTooltip.Provider value={true}>{linked}</HeldTooltip.Provider>
    </span>
  ) : (
    linked
  );
}
