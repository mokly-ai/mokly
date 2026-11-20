/**
 * The design file's measurement overlays: the selection box with its square
 * handles and tags, the size tag and the spacing redline. Each is a
 * depiction, so it draws `aria-hidden`. A selection fills its positioned
 * parent; an area's class moves or outsets it, and positions a redline.
 */

import type { ReactNode } from "react";

import { classNames } from "./class-names.js";
import { SiteIcon, type SiteIconName } from "./icons.js";
import type { SitePerson } from "./people.js";

/** Where a selection draws its square handles. */
export type SiteHandles = "all" | "corners" | "none";

const HANDLES: Record<SiteHandles, readonly string[]> = {
  all: ["nw", "n", "ne", "e", "se", "s", "sw", "w"],
  corners: ["nw", "ne", "se", "sw"],
  none: [],
};

/**
 * A size tag such as `390 × 844`: mono figures on the signal green, or on a
 * person's colour.
 */
export function SiteSizeTag({
  children,
  className,
  person,
}: {
  children: ReactNode;
  className?: string | undefined;
  person?: SitePerson | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        "site-size-tag",
        person && `site-size-tag--${person}`,
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A selection box over its positioned parent: a 1.5px outline in the signal
 * green, or in a person's colour, with square handles at the corners or at
 * the corners and the edge midpoints.
 *
 * - `name` sets a name tag over the top-left corner, after `nameIcon`, such
 *   as `T Heading`.
 * - `badge` sets a type badge over the top-right corner, such as
 *   `Geist Semibold 162`.
 * - `tag` sets a person's live tag over the top-right corner, such as
 *   `Claude is editing`. Use `badge` or `tag`, not both.
 * - `size` sets the size tag centred under the box, such as `1035 × 156`.
 * - `soft` tints the outline, for a frame that holds text, as the open page
 *   of the documentation draws it.
 */
export function SiteSelection({
  badge,
  className,
  handles = "corners",
  name,
  nameIcon = "text",
  person,
  size,
  soft = false,
  tag,
}: {
  badge?: ReactNode | undefined;
  className?: string | undefined;
  handles?: SiteHandles | undefined;
  name?: ReactNode | undefined;
  nameIcon?: SiteIconName | undefined;
  person?: SitePerson | undefined;
  size?: string | undefined;
  soft?: boolean | undefined;
  tag?: ReactNode | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        "site-sel",
        person && `site-sel--${person}`,
        soft && "site-sel--soft",
        className,
      )}
    >
      {HANDLES[handles].map((at) => (
        <span className={`site-sel-handle site-sel-handle--${at}`} key={at} />
      ))}
      {name === undefined ? null : (
        <span className="site-sel-name">
          <SiteIcon name={nameIcon} size={13} />
          {name}
        </span>
      )}
      {badge === undefined ? null : (
        <span className="site-sel-badge">{badge}</span>
      )}
      {tag === undefined ? null : <span className="site-sel-tag">{tag}</span>}
      {size === undefined ? null : (
        <SiteSizeTag className="site-sel-size" person={person}>
          {size}
        </SiteSizeTag>
      )}
    </span>
  );
}

/**
 * A spacing redline in the signal green with its value tag: vertical by
 * default, horizontal with `horizontal`. The area's class sets its place and
 * its length.
 */
export function SiteRedline({
  className,
  horizontal = false,
  value,
}: {
  className?: string | undefined;
  horizontal?: boolean | undefined;
  value: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        "site-redline",
        horizontal ? "site-redline--h" : "site-redline--v",
        className,
      )}
    >
      <span className="site-redline-value">{value}</span>
    </span>
  );
}
