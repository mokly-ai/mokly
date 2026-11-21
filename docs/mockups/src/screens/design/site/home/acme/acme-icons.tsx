/**
 * The icons of the depicted acme/storefront app: its own 20px line set,
 * drawn in the current colour, so that the coffee shop reads as another
 * brand than Mokly. Each icon sits inside a depiction, so it carries
 * `aria-hidden`.
 */

import type { ReactNode } from "react";

const DRAWINGS = {
  back: <path d="M12 4.5 6.5 10l5.5 5.5" />,
  bag: (
    <>
      <path d="M5 7h10l-.8 9.2a1 1 0 0 1-1 .8H6.8a1 1 0 0 1-1-.8z" />
      <path d="M7.5 7V6a2.5 2.5 0 0 1 5 0v1" />
    </>
  ),
  bank: (
    <path d="M3.5 8 10 4l6.5 4M5 8.5v6M8.3 8.5v6M11.7 8.5v6M15 8.5v6M3.5 16h13" />
  ),
  box: (
    <>
      <path d="m10 3.5 6 3v7l-6 3-6-3v-7z" />
      <path d="m4 6.5 6 3 6-3M10 9.5v7" />
    </>
  ),
  card: (
    <>
      <rect height="10" rx="2" width="14" x="3" y="5" />
      <path d="M3 8.5h14M6 12h3" />
    </>
  ),
  check: <path d="m5 10.5 3 3 7-7" />,
  gear: (
    <>
      <circle cx="10" cy="10" r="2.4" />
      <path d="M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2M5.4 5.4l1.4 1.4M13.2 13.2l1.4 1.4M5.4 14.6l1.4-1.4M13.2 6.8l1.4-1.4" />
    </>
  ),
  lock: (
    <>
      <rect height="7.5" rx="1.6" width="10" x="5" y="9" />
      <path d="M7.2 9V7a2.8 2.8 0 0 1 5.6 0v2" />
    </>
  ),
  pin: (
    <>
      <path d="M10 17s5-4.4 5-8.5a5 5 0 0 0-10 0C5 12.6 10 17 10 17z" />
      <circle cx="10" cy="8.5" r="1.8" />
    </>
  ),
  repeat: (
    <>
      <path d="M4 9a5 5 0 0 1 9-3l1.5 1.5M16 11a5 5 0 0 1-9 3L5.5 12.5" />
      <path d="M14.5 4v3.5H11M5.5 16v-3.5H9" />
    </>
  ),
  search: (
    <>
      <circle cx="9" cy="9" r="5" />
      <path d="m13 13 3.5 3.5" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 6.5h11a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 14.5V6A1.5 1.5 0 0 1 5 4.5h8" />
      <circle cx="13.2" cy="11.2" r=".9" />
    </>
  ),
} satisfies Record<string, ReactNode>;

/** The name of one icon of the acme app. */
export type AcmeIconName = keyof typeof DRAWINGS;

/** One acme icon, 20px unless the stylesheet sizes it. */
export function AcmeIcon({ name }: { name: AcmeIconName }) {
  return (
    <svg
      aria-hidden="true"
      className="site-acme-icon"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 20 20"
    >
      {DRAWINGS[name]}
    </svg>
  );
}
