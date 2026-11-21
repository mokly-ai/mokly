/**
 * One icon of the Canvas icon set inside a React island, drawn as
 * `Icon.astro` draws it: `size` pixels square, stroked in the current colour,
 * decorative and hidden from assistive technology. The drawings and their
 * view boxes come from `icons.ts`, the one source of the set.
 */

import { ICONS, VIEW_BOXES, type IconName } from "../icons.js";

/** One Canvas icon at `size` pixels, 16 by default. */
export function CanvasIcon({
  name,
  size = 16,
}: {
  readonly name: IconName;
  readonly size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox={VIEW_BOXES[name] ?? "0 0 16 16"}
      width={size}
    />
  );
}
