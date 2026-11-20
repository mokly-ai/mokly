/**
 * An artboard of the depicted acme/storefront app: one screen at its native
 * size, scaled into a framed box and labelled with its path, its device and,
 * for a dark screen, the moon. The spread and every feature frame place
 * artboards; the class of the place sets the box size and the scale, and
 * the spread passes each artboard's spot on the canvas as `at`.
 */

import type { CSSProperties, ReactNode } from "react";

import { classNames } from "../parts/class-names.js";
import { SiteIcon } from "../parts/icons.js";

/** A spot on a canvas, in pixels from its origin. */
export interface CanvasSpot {
  x: number;
  y: number;
}

/** The inline position of an element at one spot of a canvas. */
export function spotStyle(at: CanvasSpot | undefined): CSSProperties {
  return at === undefined ? {} : { left: at.x, top: at.y };
}

/** One artboard and the screen it shows. */
export function Artboard({
  at,
  children,
  className,
  dark = false,
  device,
  live = false,
  name,
  overlay,
}: {
  at?: CanvasSpot | undefined;
  children: ReactNode;
  className?: string | undefined;
  dark?: boolean | undefined;
  device: "desktop" | "phone";
  live?: boolean | undefined;
  name: string;
  overlay?: ReactNode | undefined;
}) {
  return (
    <figure
      className={classNames(
        "site-home-board",
        `site-home-board--${device}`,
        className,
      )}
      style={spotStyle(at)}
    >
      <figcaption className="site-home-board-label">
        <SiteIcon name={device} size={12} />
        {name}
        {dark ? <SiteIcon name="moon" size={12} /> : null}
        {live ? (
          <span className="site-home-board-live">
            <span className="site-home-live-dot" />
            Live
          </span>
        ) : null}
      </figcaption>
      <div className="site-home-board-frame">
        <div className="site-home-board-screen">{children}</div>
      </div>
      {overlay}
    </figure>
  );
}
