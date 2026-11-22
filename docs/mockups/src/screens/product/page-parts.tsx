import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import type { ButtonIcon } from "../../components/button";
import { ErrorDetails } from "../../components/error-details";
import { Button } from "../../entries/design/button.mockup";

import { Icon, iconSize } from "./icons";
import type { IconName } from "./icons";
import { SectionHeading } from "./navigation";
import type { SectionTitle } from "./navigation";
import { PendingName, WaitRegion } from "./placeholders";
import type { WaitProps } from "./placeholders";

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
  return to && !disabled ? (
    <MockLink asChild to={to}>
      {control}
    </MockLink>
  ) : (
    control
  );
}

/**
 * The way back to the previous step: an ink link with the back glyph, never a
 * button, so it cannot compete with the primary above it or spend the accent.
 */
export function BackLink({
  to,
  label = "Back",
}: {
  to: string;
  label?: string;
}) {
  return (
    <MockLink to={to} className="fo-back-link">
      <Icon name="back" size={16} />
      <span>{label}</span>
    </MockLink>
  );
}

/**
 * A destination outside the application: an ink link with the external glyph,
 * never a button, because leaving for somebody else's page is not an operation
 * this surface performs.
 *
 * `newTab` is the default, because the page the reader left keeps its place and
 * whatever they had typed on it, so a link that opens one is not a way out of
 * the surface it sits on. Leaving in the same tab is the shape that walks past
 * an unsaved-work guard, so a caller has to ask for it, exactly as the running
 * product's own component does.
 */
export function ExternalLink({
  to,
  label,
  newTab = true,
}: {
  to: string;
  label: string;
  newTab?: boolean;
}) {
  return (
    <a
      className="fo-site-link"
      href={to}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
    >
      <span>{label}</span>
      <Icon name="external" size={13} />
    </a>
  );
}

/** Public-site destinations are real external links, not catalogue entries. */
export function SiteLink({ href, label }: { href: string; label: string }) {
  return <ExternalLink to={href} label={label} newTab={false} />;
}

export function Section({
  title,
  description,
  children,
  action,
}: {
  title: SectionTitle;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="fo-section">
      <SectionHeading title={title} description={description}>
        {action}
      </SectionHeading>
      {children}
    </section>
  );
}

/**
 * The shape every screen falls back to when there is nothing to show yet or a
 * request failed: one glyph, one line of consequence, one way forward. A
 * failure Mokly answered closes with the reference a report needs; one raised
 * in the browser carries none.
 */
type StateMessageFrame = {
  children?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
  reference?: string;
  /** Plain viewer diagnostics in a closed secondary disclosure. */
  details?: string;
  heading?: "h1" | "h2";
};

type ErrorStateCopy =
  | { error: true; title: string; children?: ReactNode; announcement?: never }
  | { error: true; title?: never; children: ReactNode; announcement?: never }
  | {
      error: true;
      title?: never;
      children?: never;
      announcement: string;
    };

type StateMessageProps = StateMessageFrame &
  (
    | ErrorStateCopy
    | {
        error?: false;
        title?: string;
        children?: ReactNode;
        announcement?: never;
      }
  );

export function StateMessage({
  title,
  children,
  announcement,
  action,
  error = false,
  icon,
  reference,
  details,
  heading = "h2",
}: StateMessageProps) {
  const Heading = heading;
  return (
    <section
      className={"fo-state" + (error ? " fo-state-problem" : "")}
      role={error ? "alert" : undefined}
    >
      <span className="fo-state-glyph">
        <Icon
          name={icon ?? (error ? "problem" : "empty")}
          size={iconSize.state}
        />
      </span>
      {title && <Heading className="fo-state-title">{title}</Heading>}
      {children && <p className="fo-state-detail">{children}</p>}
      {announcement && <span className="fo-sr-only">{announcement}</span>}
      {action && <div className="fo-state-action">{action}</div>}
      <ErrorDetails reference={reference} details={details} />
    </section>
  );
}

/**
 * The waiting region of a read, which `WaitRegion` draws around the layout
 * that the read waits for: a wait always draws that layout, never a block of
 * its own.
 */
export function Pending(props: WaitProps) {
  return <WaitRegion {...props} />;
}

/**
 * Read-only facts on one label column, so values align across sections. The
 * ruled variant separates each pair with a hairline instead of a filled panel,
 * because a grey box around a value reads as a disabled input.
 */
export function Facts({
  rows,
  ruled = false,
}: {
  rows: readonly (readonly [string, ReactNode])[];
  ruled?: boolean;
}) {
  return (
    <dl className={"fo-facts" + (ruled ? " fo-facts-ruled" : "")}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A live address preview beneath the slug field that controls it. While a read
 * decides the address, `hold` stands in its place: the read's name, or a bar,
 * which no paragraph may hold, so the line is then a `div`.
 */
export function AddressPreview(
  props: { address: string } | { hold: ReactNode },
) {
  const Line = "hold" in props ? "div" : "p";
  return (
    <Line className="fo-address-preview">
      <span>Address</span>
      {"hold" in props ? props.hold : <code>{props.address}</code>}
    </Line>
  );
}
