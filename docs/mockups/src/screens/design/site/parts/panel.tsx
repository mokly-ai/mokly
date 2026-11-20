/**
 * The floating panel of the design file: a raised surface on the canvas
 * with a head that names it, a body and an optional foot. The home's Specs
 * panel, the documentation's Layers and Inspect panels and the changelog's
 * Version history panel compose it, each with its own rows.
 */

import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { classNames } from "./class-names.js";
import { SiteIcon, type SiteIconName } from "./icons.js";

/**
 * A floating panel. `title` heads it, with `meta` at the head's other end,
 * such as `Docs` or the mono `install.md` (`metaMono`). The panel is an
 * `aside` named by its title unless `as` and `label` say otherwise. The area
 * sets its width and whether it sticks while the page scrolls.
 */
export function SitePanel({
  as: Tag = "aside",
  children,
  className,
  foot,
  label,
  meta,
  metaMono = false,
  title,
}: {
  as?: "aside" | "div" | "nav" | "section" | undefined;
  children: ReactNode;
  className?: string | undefined;
  foot?: ReactNode | undefined;
  label?: string | undefined;
  meta?: ReactNode | undefined;
  metaMono?: boolean | undefined;
  title: ReactNode;
}) {
  return (
    <Tag
      aria-label={label ?? (typeof title === "string" ? title : undefined)}
      className={classNames("site-panel", className)}
    >
      <div className="site-panel-head">
        <p className="site-panel-title">{title}</p>
        {meta === undefined ? null : (
          <span
            className={classNames(
              "site-panel-meta",
              metaMono && "site-panel-meta--mono",
            )}
          >
            {meta}
          </span>
        )}
      </div>
      <div className="site-panel-body">{children}</div>
      {foot === undefined ? null : (
        <div className="site-panel-foot">{foot}</div>
      )}
    </Tag>
  );
}

/**
 * One row of a panel's list: an icon, the label and an optional trailing
 * note, at least 44px tall. `to` links a catalogue entry through `MockLink`,
 * `href` links in the page or outside it, and a row with neither is plain
 * text, the rule for a destination that no mockup owns. `current` marks the
 * row with `aria-current` and the selected fill. `className` adds an area's
 * own class, such as the documentation tree's row class.
 */
export function SitePanelRow({
  children,
  className: areaClass,
  current,
  href,
  icon,
  to,
  trailing,
}: {
  children: ReactNode;
  className?: string | undefined;
  current?: "location" | "page" | "true" | undefined;
  href?: string | undefined;
  icon?: SiteIconName | undefined;
  to?: string | undefined;
  trailing?: ReactNode | undefined;
}) {
  const className = classNames(
    "site-panel-row",
    current !== undefined && "site-panel-row--current",
    areaClass,
  );
  const content = (
    <>
      {icon === undefined ? null : <SiteIcon name={icon} size={14} />}
      <span className="site-panel-row-label">{children}</span>
      {trailing === undefined ? null : (
        <span className="site-panel-row-trail">{trailing}</span>
      )}
    </>
  );
  if (to !== undefined)
    return (
      <MockLink aria-current={current} className={className} to={to}>
        {content}
      </MockLink>
    );
  if (href !== undefined)
    return (
      <a aria-current={current} className={className} href={href}>
        {content}
      </a>
    );
  return (
    <span aria-current={current} className={className}>
      {content}
    </span>
  );
}
