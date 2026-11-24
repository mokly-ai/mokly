/**
 * The drawings of the Canvas icons that the pages use beside the chrome: the
 * documentation's panels and search, the changelog's release groups and
 * feed, and the pricing plans, each copied from the prototype page's own
 * icon sprite onto a 16px grid. `icons.tsx` draws them.
 */

import type { ReactNode } from "react";

/** The page icons, by name. */
export const PAGE_ICONS = {
  alert: (
    <>
      <path d="M7.1 2.7a1 1 0 0 1 1.8 0l5.2 9.5a1 1 0 0 1-.9 1.5H2.8a1 1 0 0 1-.9-1.5z" />
      <path d="M8 6.4v3M8 11.5h.01" />
    </>
  ),
  arrowLeft: <path d="M13.2 8H2.8M6.8 4l-4 4 4 4" />,
  arrowRight: <path d="M2.8 8h10.4M9.2 4l4 4-4 4" />,
  bolt: <path d="M8.9 1.7 3.4 9.1h4.1l-.9 5.2 6-7.6H8.4z" />,
  calendar: (
    <>
      <rect height="10.6" rx="1.6" width="11.6" x="2.2" y="3" />
      <path d="M2.2 6.4h11.6M5.4 1.8v2.4M10.6 1.8v2.4" />
    </>
  ),
  card: (
    <>
      <rect height="9.2" rx="1.6" width="12.4" x="1.8" y="3.4" />
      <path d="M1.8 6.6h12.4M4.4 10h2.6" />
    </>
  ),
  commit: (
    <>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M1.5 8h4M10.5 8h4" />
    </>
  ),
  doc: (
    <>
      <path d="M4 1.9h5l3.1 3.1v8c0 .6-.5 1.1-1.1 1.1H4c-.6 0-1.1-.5-1.1-1.1V3c0-.6.5-1.1 1.1-1.1z" />
      <path d="M9 1.9V5h3.1M5.4 8.3h5.2M5.4 10.9h3.4" />
    </>
  ),
  down: <path d="M8 3v9.8M4.2 9 8 12.8 11.8 9" />,
  end: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.6 8h4.8" />
    </>
  ),
  enter: (
    <path d="M12.8 3.2v4.6c0 .9-.7 1.6-1.6 1.6H3.4M6.2 6.6 3.4 9.4l2.8 2.8" />
  ),
  external: (
    <path d="M9.4 2.8h3.8v3.8M13.2 2.8 7.6 8.4M11.8 9.4v2.9c0 .6-.5 1-1 1H3.8c-.6 0-1-.4-1-1V5.3c0-.6.4-1 1-1h2.9" />
  ),
  feature: (
    <>
      <rect height="11.4" rx="3" width="11.4" x="2.3" y="2.3" />
      <path d="M8 5.4v5.2M5.4 8h5.2" />
    </>
  ),
  feed: (
    <>
      <path d="M3.2 2.8a10 10 0 0 1 10 10M3.2 7a5.8 5.8 0 0 1 5.8 5.8" />
      <circle cx="3.9" cy="12.1" r="1.1" />
    </>
  ),
  fix: (
    <path d="M9.8 4.2a.67.67 0 0 0 0 .93l1.07 1.07a.67.67 0 0 0 .93 0l2.51-2.51a4 4 0 0 1-5.29 5.29l-4.6 4.6a1.41 1.41 0 0 1-2-2l4.6-4.6a4 4 0 0 1 5.29-5.29z" />
  ),
  hash: (
    <path d="M6.4 2.6 5 13.4M11.2 2.6 9.8 13.4M2.9 5.9h10.6M2.5 10.1h10.6" />
  ),
  inspect: (
    <>
      <path d="M2.4 4.4h3.4M9 4.4h4.6M2.4 11.6h6.2M11.8 11.6h1.8" />
      <circle cx="7.4" cy="4.4" r="1.6" />
      <circle cx="10.2" cy="11.6" r="1.6" />
    </>
  ),
  layers: (
    <>
      <path d="M8 2.1 14 5.2 8 8.3 2 5.2z" />
      <path d="m2 8 6 3.1L14 8M2 10.8l6 3.1 6-3.1" />
    </>
  ),
  lock: (
    <>
      <rect height="6.6" rx="1.6" width="9.6" x="3.2" y="7.2" />
      <path d="M5.4 7.2V5.4a2.6 2.6 0 0 1 5.2 0v1.8" />
    </>
  ),
  outline: <path d="M2.6 4h.8M6 4h7.4M2.6 8h.8M6 8h7.4M2.6 12h.8M6 12h7.4" />,
  receipt: (
    <>
      <path d="M3.5 1.9h9v12.2l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z" />
      <path d="M5.8 5.4h4.4M5.8 8.2h4.4" />
    </>
  ),
  tag: (
    <>
      <path d="M2.3 7.4v-4c0-.6.5-1.1 1.1-1.1h4c.3 0 .6.1.8.3l5.5 5.5c.4.4.4 1.1 0 1.6l-4 4c-.4.4-1.1.4-1.6 0L2.6 8.2c-.2-.2-.3-.5-.3-.8z" />
      <circle cx="5.3" cy="5.3" r=".9" />
    </>
  ),
  up: <path d="M8 13V3.2M4.2 7 8 3.2 11.8 7" />,
  users: (
    <>
      <circle cx="6" cy="5.6" r="2.3" />
      <path d="M1.8 13.4c.5-2.4 2.2-3.8 4.2-3.8s3.7 1.4 4.2 3.8" />
      <path d="M10.2 3.5a2.3 2.3 0 0 1 0 4.3M12 9.9c1.2.6 1.9 1.8 2.2 3.5" />
    </>
  ),
} as const satisfies Record<string, ReactNode>;
