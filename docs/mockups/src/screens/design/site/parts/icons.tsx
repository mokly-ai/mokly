/**
 * The Canvas icon set: the line icons of the design file's tool voice, drawn
 * on a 16px grid with a 1.5px stroke in the current colour, so the site's
 * roles decide every stroke. An icon is decorative: it carries
 * `aria-hidden`, and the text beside it names the control.
 *
 * Use: `<SiteIcon name="branch" size={13} />`. The drawings live in
 * `icon-drawings.tsx` (chrome and canvas) and `icon-drawings-pages.tsx`
 * (the pages' own icons).
 */

import { PAGE_ICONS } from "./icon-drawings-pages.js";
import { CANVAS_ICONS } from "./icon-drawings.js";

/** Every Canvas icon, by name. */
const ICONS = { ...CANVAS_ICONS, ...PAGE_ICONS };

/** The name of one icon of the Canvas icon set. */
export type SiteIconName = keyof typeof ICONS;

/** The icons drawn on another grid than the 16px one. */
const VIEW_BOXES: Partial<Record<SiteIconName, string>> = {
  github: "0 0 24 24",
};

/** One Canvas icon at `size` pixels, in the current colour. */
export function SiteIcon({
  className,
  name,
  size = 16,
}: {
  className?: string | undefined;
  name: SiteIconName;
  size?: number | undefined;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox={VIEW_BOXES[name] ?? "0 0 16 16"}
      width={size}
    >
      {ICONS[name]}
    </svg>
  );
}
