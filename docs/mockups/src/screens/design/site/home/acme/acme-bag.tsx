/**
 * The coffee of the depicted acme/storefront app: a bag in one of the four
 * roasts, the tinted tile that frames a bag in a list, and the scattered
 * beans of the welcome art. A roast's tone class gives the current colour;
 * every part of the bag mixes its own fill from it in the stylesheet.
 */

import { classNames } from "../../parts/class-names.js";

/** One of the four roasts that the shop sells. */
export type AcmeRoast = "decaf" | "guji" | "huila" | "nyeri";

/** The class that gives a roast's colour to the parts inside it. */
export function roastTone(roast: AcmeRoast): string {
  return `site-acme-tone--${roast}`;
}

/** A bag of one roast, coloured by its tone. */
export function AcmeBag({
  className,
  roast,
}: {
  className?: string | undefined;
  roast: AcmeRoast;
}) {
  return (
    <svg
      aria-hidden="true"
      className={classNames("site-acme-bag", roastTone(roast), className)}
      focusable="false"
      viewBox="0 0 64 84"
    >
      <ellipse
        className="site-acme-bag-shadow"
        cx="32"
        cy="80.5"
        rx="23"
        ry="2.6"
      />
      <path
        className="site-acme-bag-body"
        d="M13 14h38l4 60a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4z"
      />
      <path
        className="site-acme-bag-side"
        d="M44 14h7l4 60a4 4 0 0 1-4 4h-6z"
      />
      <path
        className="site-acme-bag-shine"
        d="M13 14h5l-1.2 64H13a4 4 0 0 1-4-4z"
      />
      <rect
        className="site-acme-bag-top"
        height="10"
        rx="1.6"
        width="39"
        x="12.5"
        y="6"
      />
      <path className="site-acme-bag-fold" d="M15 9.4h34M15 12.4h34" />
      <rect
        className="site-acme-bag-label"
        height="31"
        rx="3"
        width="28"
        x="18"
        y="31"
      />
      <circle className="site-acme-bag-mark" cx="32" cy="42" r="5.6" />
      <path
        className="site-acme-bag-mark"
        d="M29.4 44.3c1.9-1.1 3.2-3.1 5-4.5"
      />
      <rect
        className="site-acme-bag-line"
        height="2.3"
        rx="1.15"
        width="18"
        x="23"
        y="52"
      />
      <rect
        className="site-acme-bag-line site-acme-bag-line--soft"
        height="1.8"
        rx=".9"
        width="12"
        x="26"
        y="56.4"
      />
    </svg>
  );
}

/** The tinted square that frames a bag in a list, in three sizes. */
export function AcmeTile({
  roast,
  size = "large",
}: {
  roast: AcmeRoast;
  size?: "large" | "medium" | "small" | undefined;
}) {
  return (
    <span
      className={classNames(
        "site-acme-tile",
        `site-acme-tile--${size}`,
        roastTone(roast),
      )}
    >
      <AcmeBag roast={roast} />
    </span>
  );
}

/** Where each bean of the welcome art lies: x, y, scale and turn. */
const BEANS = [
  [70, 330, 1.5, 20],
  [104, 352, 1.2, -30],
  [300, 342, 1.45, 60],
  [330, 316, 1.1, 10],
  [268, 366, 1.05, -50],
  [52, 300, 1, 70],
] as const;

/** The beans scattered at the foot of the welcome art. */
export function AcmeBeans() {
  return (
    <svg
      aria-hidden="true"
      className="site-acme-beans"
      focusable="false"
      viewBox="0 0 390 420"
    >
      {BEANS.map(([x, y, scale, turn]) => (
        <g
          key={`${x}-${y}`}
          transform={`translate(${x} ${y}) rotate(${turn}) scale(${scale})`}
        >
          <ellipse className="site-acme-bean" rx="6" ry="4.3" />
          <path
            className="site-acme-bean-crease"
            d="M-4.7.5c2.3-1.7 5.2-1.7 9.4-.5"
          />
        </g>
      ))}
    </svg>
  );
}
