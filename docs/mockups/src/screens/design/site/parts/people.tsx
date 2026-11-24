/**
 * The people and agents who work in the depicted design file: Maya (pink)
 * and Sam (blue), and the agents Claude (orange) and Codex (violet). Their
 * avatars, the presence group and their cursors are depictions, so each
 * draws `aria-hidden` and holds nothing that takes focus.
 */

import { MoklyMark } from "./brand.js";
import { classNames as classes } from "./class-names.js";
import { SiteIcon } from "./icons.js";

/** One person or agent on the canvas. */
export type SitePerson = "maya" | "sam" | "claude" | "codex";

/** Every person and agent, in the order the presence group draws them. */
export const SITE_PEOPLE: readonly SitePerson[] = [
  "maya",
  "sam",
  "claude",
  "codex",
];

/** The name each person goes by on a cursor, and whether it is an agent. */
const PEOPLE: Record<SitePerson, { agent: boolean; name: string }> = {
  claude: { agent: true, name: "Claude" },
  codex: { agent: true, name: "Codex" },
  maya: { agent: false, name: "Maya" },
  sam: { agent: false, name: "Sam" },
};

/**
 * One avatar: a person's initial, an agent's spark, or the Mokly mark for
 * answers that Mokly gives, on a ring of the surface it sits on. `small`
 * draws the 22px size of the status bar; the default is 28px.
 */
export function SiteAvatar({
  className,
  person,
  small = false,
}: {
  className?: string | undefined;
  person: SitePerson | "mokly";
  small?: boolean | undefined;
}) {
  const content =
    person === "mokly" ? (
      <MoklyMark size={18} />
    ) : PEOPLE[person].agent ? (
      <SiteIcon name="spark" size={small ? 11 : 13} />
    ) : (
      PEOPLE[person].name[0]
    );
  return (
    <span
      aria-hidden="true"
      className={classes(
        "site-avatar",
        `site-avatar--${person}`,
        small && "site-avatar--small",
        className,
      )}
    >
      {content}
    </span>
  );
}

/** The overlapping avatars of everyone in the file. */
export function SitePresence({
  className,
  people = SITE_PEOPLE,
  small = false,
}: {
  className?: string | undefined;
  people?: readonly SitePerson[] | undefined;
  small?: boolean | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      className={classes(
        "site-presence",
        small && "site-presence--small",
        className,
      )}
    >
      {people.map((person) => (
        <SiteAvatar key={person} person={person} small={small} />
      ))}
    </span>
  );
}

/**
 * A cursor: the arrow in the person's colour with the name label beside it,
 * and the `Agent` badge on an agent's label. `flip` puts the label on the
 * arrow's left, for a cursor near the right edge. Position it from the
 * area's stylesheet through `className`; its parent sets
 * `position: relative`.
 */
export function SiteCursor({
  className,
  flip = false,
  person,
}: {
  className?: string | undefined;
  flip?: boolean | undefined;
  person: SitePerson;
}) {
  const { agent, name } = PEOPLE[person];
  return (
    <span
      aria-hidden="true"
      className={classes(
        "site-cursor",
        `site-cursor--${person}`,
        flip && "site-cursor--flip",
        className,
      )}
    >
      <svg
        className="site-cursor-arrow"
        height="22"
        viewBox="0 0 20 22"
        width="20"
      >
        <path d="M2.6 2.2 17 9.9l-6.3 1.8-2.9 6.5z" />
      </svg>
      <span className="site-cursor-tag">
        {agent ? <SiteIcon name="spark" size={11} /> : null}
        {name}
        {agent ? <em className="site-cursor-agent">Agent</em> : null}
      </span>
    </span>
  );
}
