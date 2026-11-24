/**
 * The small labels of the Canvas pages: the mono kicker above a heading, the
 * chip for a version or a status, and the section box that groups frames on
 * the canvas under a dark tag.
 */

import type { ReactNode } from "react";

import { classNames } from "./class-names.js";
import { SiteIcon, type SiteIconName } from "./icons.js";

/**
 * The mono kicker above a heading, such as `01 Browse`. The stylesheet sets
 * it in uppercase, and draws its `index` in the green of signal text.
 */
export function SiteKicker({
  as: Tag = "p",
  children,
  className,
  index,
}: {
  as?: "div" | "p" | "span" | undefined;
  children: ReactNode;
  className?: string | undefined;
  index?: string | undefined;
}) {
  return (
    <Tag className={classNames("site-kicker", className)}>
      {index === undefined ? null : (
        <>
          <b className="site-kicker-index">{index}</b>{" "}
        </>
      )}
      {children}
    </Tag>
  );
}

/** The tone of a chip. */
export type SiteChipTone = "changed" | "neutral" | "removed" | "signal";

/**
 * A chip: a short label on a pill. `signal` is the green of a version such
 * as `0.19.0`, of `Latest` and of an added entry; `changed` and `removed`
 * mark a change; `neutral` sits on the canvas tone with a hairline, as the
 * `main` branch chip does. `mono` sets versions and branch names in Geist
 * Mono, `dot` leads with a status dot and `icon` with an icon.
 */
export function SiteChip({
  children,
  className,
  dot = false,
  icon,
  mono = false,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string | undefined;
  dot?: boolean | undefined;
  icon?: SiteIconName | undefined;
  mono?: boolean | undefined;
  tone?: SiteChipTone | undefined;
}) {
  return (
    <span
      className={classNames(
        "site-chip",
        `site-chip--${tone}`,
        mono && "site-chip--mono",
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="site-chip-dot" /> : null}
      {icon === undefined ? null : <SiteIcon name={icon} size={13} />}
      {children}
    </span>
  );
}

/**
 * A section of the canvas that groups frames: a light wash with a hairline,
 * headed by a dark tag such as `Specs` and an optional `meta` line beside
 * it, such as `acme/storefront · main · 24 screens`. With `tagId`, the box is
 * a group that its tag names.
 */
export function SiteSectionBox({
  children,
  className,
  meta,
  tag,
  tagId,
}: {
  children: ReactNode;
  className?: string | undefined;
  meta?: ReactNode | undefined;
  tag: ReactNode;
  tagId?: string | undefined;
}) {
  return (
    <div
      aria-labelledby={tagId}
      className={classNames("site-section-box", className)}
      role={tagId === undefined ? undefined : "group"}
    >
      <div className="site-section-box-head">
        <span className="site-section-box-tag" id={tagId}>
          {tag}
        </span>
        {meta === undefined ? null : (
          <span className="site-section-box-meta">{meta}</span>
        )}
      </div>
      {children}
    </div>
  );
}
