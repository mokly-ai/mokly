import { SkeletonCircle } from "@firna/ui/skeleton";
import type { ReactNode } from "react";

import { Avatar } from "../../entries/design/avatar.mockup";
import { sample } from "../../fixtures/product";
import { site } from "../../fixtures/site";

import { MoklyMark } from "./mark";
import { TextBar } from "./placeholders";

function Wordmark() {
  return (
    <>
      <MoklyMark size={22} />
      <span>
        mokly<span className="review-period">.</span>
      </span>
    </>
  );
}

/**
 * Inside the product the mark is the signed-in identity of the surface, not a
 * destination: every product route already resolves into the viewer. The
 * viewer's top bar takes the compact form, where the project trigger beside it
 * names the workspace and the project and a wordmark would only repeat the
 * brand.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="review-brand">
      {compact ? <MoklyMark size={22} /> : <Wordmark />}
    </span>
  );
}

/**
 * The logged-out account screens leave for the public site from the mark. The
 * mark keeps the brand accent on every surface; the wordmark is ink with a
 * signal period.
 */
export function SiteBrand() {
  return (
    <a className="review-brand" href={site.home} aria-label="Mokly home">
      <Wordmark />
    </a>
  );
}

/** The diameter of the identity's avatar, in px, which its placeholder keeps. */
const identityAvatar = 26;

/**
 * The signed-in identity shown in the onboarding shell's header. A reader who
 * has set a display name is called by it, with their email as the tooltip, so
 * the account behind the name is one hover away. A reader called by their
 * email carries no tooltip, because the label is already the whole value.
 */
export function Account({
  person = sample.viewer,
}: {
  person?: { name: string; initials: string; email?: string };
}) {
  return (
    <div
      className="review-account"
      data-reviewer={person.name}
      title={person.email === person.name ? undefined : person.email}
    >
      <Avatar
        moklyInstance="current-person"
        label={person.initials}
        decorative
        tone="soft"
        size={identityAvatar}
      />
      <span>{person.name}</span>
    </div>
  );
}

/**
 * The identity while the session read that supplies it runs: the avatar at
 * its own size and a bar in the name's line box, in the identity's own frame.
 * Like every placeholder it is hidden from assistive technology.
 */
export function AccountPlaceholder() {
  return (
    <div className="review-account" aria-hidden="true">
      <SkeletonCircle diameter={identityAvatar} />
      <TextBar width="2.5em" />
    </div>
  );
}

/**
 * A section's heading, or while the read that decides it runs, a bar of the
 * heading's line height, `bar` wide: a heading that only a non-empty list
 * shows waits with that list. A heading whose words are known but whose name
 * a read supplies, such as the workspace's name, keeps those words `before`
 * its bar. The heading's box measures its content, so `bar` is a length such
 * as `9em`, never a percentage of that box.
 */
export type SectionTitle = ReactNode | { bar: string; before?: string };

/** Whether a section's heading is waiting for the read that decides it. */
function waitingTitle(
  title: SectionTitle,
): title is { bar: string; before?: string } {
  return typeof title === "object" && title !== null && "bar" in title;
}

/**
 * A section heading with an optional action on the same baseline. Sections are
 * the one rhythm every Folio surface shares, so their spacing lives in CSS. A
 * waiting heading keeps its frame; its bar is hidden from assistive technology
 * like every placeholder, so the heading is too, and the waiting region names
 * the read instead of an empty heading.
 */
export function SectionHeading({
  title,
  description,
  children,
}: {
  title: SectionTitle;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="review-section-heading">
      <div className="fo-section-copy">
        {waitingTitle(title) ? (
          <h2 aria-hidden="true">
            {title.before === undefined ? null : title.before + " "}
            <TextBar width={title.bar} />
          </h2>
        ) : (
          <h2>{title}</h2>
        )}
        {description && <p className="fo-section-detail">{description}</p>}
      </div>
      {children}
    </div>
  );
}
