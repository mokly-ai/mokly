/**
 * The label of a frame on the canvas: an icon and the frame's name in mono,
 * set over the frame's top-left corner, with an optional size at its right
 * end. A depiction of the design file, so it draws `aria-hidden`.
 */

import type { ReactNode } from "react";

import { classNames } from "./class-names.js";
import { SiteIcon, type SiteIconName } from "./icons.js";

/**
 * A frame label, such as `Footer` or `legal/terms.md`. Its frame sets
 * `position: relative`. A `selected` frame draws its label in the signal
 * green. `name` may hold markup: a `b` inside it stands out, as the file
 * name of a path does.
 */
export function SiteFrameLabel({
  className,
  icon = "frame",
  name,
  selected = false,
  size,
}: {
  className?: string | undefined;
  icon?: SiteIconName | undefined;
  name: ReactNode;
  selected?: boolean | undefined;
  size?: string | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        "site-frame-name",
        selected && "site-frame-name--selected",
        className,
      )}
    >
      <SiteIcon name={icon} size={13} />
      <span className="site-frame-name-text">{name}</span>
      {size === undefined ? null : (
        <span className="site-frame-name-size">{size}</span>
      )}
    </span>
  );
}
