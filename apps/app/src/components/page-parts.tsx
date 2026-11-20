import { useId } from "react";
import type { ReactNode } from "react";

import { appAddress } from "../config";

import { AppLink } from "./app-link";
import { Icon, iconSize } from "./icons";
import type { IconName } from "./icons";
import { TextBar, WaitRegion } from "./placeholders";
import type { WaitProps } from "./placeholders";

/**
 * The way back to the previous step: an ink link with the back glyph, never a
 * button, so it cannot compete with the primary above it or spend the accent.
 */
export function BackLink({
  href,
  label = "Back",
}: {
  href: string;
  label?: string;
}) {
  return (
    <AppLink href={href} className="fo-back-link">
      <Icon name="back" size={16} />
      <span>{label}</span>
    </AppLink>
  );
}

/**
 * A destination outside the application: an ink link with the external glyph,
 * never a button, because leaving for somebody else's page is not an operation
 * this product performs. It takes `to` rather than `href` so a settings pane
 * can draw one: a pane that writes `href` is a door past the host's unsaved
 * work guard, which the lint over `settings/panes` refuses.
 *
 * `newTab` is the default, because the page the reader left keeps its place and
 * whatever they had typed on it, so a link that opens one is not a way out of
 * the surface it sits on. Leaving in the same tab is the shape that walks past
 * an unsaved-work guard, so a caller has to ask for it, and the lint over
 * `settings/panes` refuses it there — renaming the attribute is not a way
 * around the rule that guards it.
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

/** Public-site destinations are real external links, not in-app routes. */
export function SiteLink({ href, label }: { href: string; label: string }) {
  return <ExternalLink to={href} label={label} newTab={false} />;
}

/**
 * A section's heading, or, while the read that decides it runs, a bar of the
 * heading's line height, `bar` wide, as the catalogue's `SectionTitle` draws
 * it. A heading whose words are known but whose name a read supplies, such as
 * the workspace's name, keeps those words `before` its bar. The heading's box
 * measures its content, so `bar` is a length such as `9em`.
 */
export type SectionTitle = string | { bar: string; before?: string };

/**
 * A section heading with an optional action on the same baseline. A waiting
 * heading keeps its frame and is hidden from assistive technology like its
 * bar, so the waiting region names the read instead of an empty heading.
 */
export function SectionHeading({
  title,
  description,
  children,
  titleId,
}: {
  title: SectionTitle;
  description?: ReactNode;
  children?: ReactNode;
  /** Names the heading, for a section that points at it rather than restating it. */
  titleId?: string;
}) {
  return (
    <div className="review-section-heading">
      <div className="fo-section-copy">
        {typeof title === "string" ? (
          <h2 id={titleId}>{title}</h2>
        ) : (
          <h2 aria-hidden="true">
            {title.before === undefined ? null : title.before + " "}
            <TextBar width={title.bar} />
          </h2>
        )}
        {description && <p className="fo-section-detail">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
  action,
  labelled,
}: {
  title: SectionTitle;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  /**
   * Name the section for assistive technology, when it is one of several. The
   * name is its own heading, pointed at rather than repeated, so a reader
   * navigating landmarks does not hear the same words twice.
   */
  labelled?: boolean;
}) {
  const titleId = useId();
  return (
    <section
      className="fo-section"
      aria-labelledby={labelled ? titleId : undefined}
    >
      <SectionHeading
        title={title}
        description={description}
        titleId={labelled ? titleId : undefined}
      >
        {action}
      </SectionHeading>
      {children}
    </section>
  );
}

/**
 * The shape every screen falls back to when there is nothing to show yet or a
 * request failed: one glyph, one line of consequence, one way forward.
 */
type StateMessageFrame = {
  children?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
  details?: ReactNode;
  /** Names this state for a test, where its own copy is what is under test. */
  testID?: string;
  /** The heading level the owning screen's landmark requires. */
  heading?: "h1" | "h2";
};

/**
 * The copy an error alert must carry, in one of three mutually exclusive
 * forms: a visible title with an optional message, a visible message alone, or
 * a screen-reader-only announcement when it shows neither. The announcement
 * renders once inside the alert as `.fo-sr-only`, never as a label on the
 * whole section, and the glyph, the action and the details disclosure are not
 * state copy. The mockup catalogue's `StateMessage` encodes the same union,
 * and both suites check every rendered alert for non-whitespace copy, because
 * an empty string or an empty node satisfies these types without giving a
 * screen reader any text.
 */
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
  details,
  testID,
  heading = "h2",
}: StateMessageProps) {
  const Heading = heading;
  return (
    <section
      className={"fo-state" + (error ? " fo-state-problem" : "")}
      role={error ? "alert" : undefined}
      data-testid={testID}
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
      {details}
    </section>
  );
}

/**
 * The waiting region of a read: the layout that the read waits for, built
 * from the loaded layout's own parts in their placeholder forms, with
 * `aria-busy` and the operation's name once. A layout with a text place whose
 * text the answer decides takes the name there, as a function of it; any other
 * layout leaves the name to screen readers. A wait always draws its layout,
 * never a block of its own.
 */
export function Pending(props: WaitProps) {
  return <WaitRegion {...props} />;
}

/**
 * A live public address preview beneath the slug field that controls it. While
 * a read decides the address, `hold` stands in its place: the read's name, or a
 * bar, which no paragraph may hold, so the line is then a `div`.
 */
export function AddressPreview(props: { path: string } | { hold: ReactNode }) {
  const Line = "hold" in props ? "div" : "p";
  return (
    <Line className="fo-address-preview">
      <span>Address</span>
      {"hold" in props ? props.hold : <code>{appAddress(props.path)}</code>}
    </Line>
  );
}

/** Read-only facts, hairline separated so values align across sections. */
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
