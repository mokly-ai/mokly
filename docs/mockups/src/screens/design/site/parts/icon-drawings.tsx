/**
 * The drawings of the Canvas icons that the chrome and the canvas parts use:
 * tools, files, frames, people and the scheme control, each copied from the
 * prototype's icon sprite onto a 16px grid. `icons.tsx` draws them.
 */

import type { ReactNode } from "react";

/** The chrome and canvas icons, by name. */
export const CANVAS_ICONS = {
  agent: (
    <>
      <path d="M8 1.9c.5 3 1.6 4.7 4.6 5.6-3 .9-4.1 2.6-4.6 5.6-.5-3-1.6-4.7-4.6-5.6 3-.9 4.1-2.6 4.6-5.6z" />
      <path d="M12.6 1.8v2.6M11.3 3.1h2.6" />
    </>
  ),
  branch: (
    <>
      <circle cx="4.5" cy="3.6" r="1.6" />
      <circle cx="4.5" cy="12.4" r="1.6" />
      <circle cx="11.5" cy="5.4" r="1.6" />
      <path d="M4.5 5.2v5.6M11.5 7c0 2.6-2.4 3.3-5.6 4" />
    </>
  ),
  caret: <path d="m6.2 4.4 3.6 3.6-3.6 3.6" />,
  check: <path d="m3.4 8.4 3 3 6.2-6.8" />,
  checkCircle: (
    <>
      <circle cx="8" cy="8" r="6.2" />
      <path d="m5.3 8.2 1.9 1.9 3.6-4" />
    </>
  ),
  chevronDown: <path d="m4.5 6.3 3.5 3.5 3.5-3.5" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  comment: (
    <path d="M8 2.3c3.2 0 5.7 2.2 5.7 5s-2.5 5-5.7 5c-.8 0-1.6-.1-2.3-.4l-3.2 1.2.9-2.6C2.7 9.6 2.3 8.5 2.3 7.3c0-2.8 2.5-5 5.7-5z" />
  ),
  component: (
    <path d="M8 1.6 10.1 3.7 8 5.8 5.9 3.7zM8 10.2l2.1 2.1L8 14.4l-2.1-2.1zM3.7 5.9 5.8 8l-2.1 2.1L1.6 8zM12.3 5.9 14.4 8l-2.1 2.1L10.2 8z" />
  ),
  copy: (
    <>
      <rect height="8.4" rx="1.6" width="8.4" x="5.2" y="5.2" />
      <path d="M10.8 5.2V3.6c0-.6-.5-1.1-1.1-1.1H3.6c-.6 0-1.1.5-1.1 1.1v6.1c0 .6.5 1.1 1.1 1.1h1.6" />
    </>
  ),
  cube: (
    <>
      <path d="m8 1.8 5.6 3.1v6.2L8 14.2l-5.6-3.1V4.9z" />
      <path d="m2.4 4.9 5.6 3.1 5.6-3.1M8 8v6.2" />
    </>
  ),
  desktop: (
    <>
      <rect height="8.6" rx="1.5" width="12.4" x="1.8" y="2.4" />
      <path d="M5.6 13.8h4.8M8 11v2.8" />
    </>
  ),
  download: <path d="M8 2.4v7.8M4.7 7 8 10.3 11.3 7M3 13.2h10" />,
  file: (
    <>
      <path d="M4 1.9h5l3.1 3.1v8c0 .6-.5 1.1-1.1 1.1H4c-.6 0-1.1-.5-1.1-1.1V3c0-.6.5-1.1 1.1-1.1z" />
      <path d="M9 1.9V5h3.1" />
    </>
  ),
  folder: (
    <path d="M1.9 4.3c0-.7.5-1.2 1.2-1.2H6l1.5 1.6h5.4c.7 0 1.2.5 1.2 1.2v6c0 .7-.5 1.2-1.2 1.2H3.1c-.7 0-1.2-.5-1.2-1.2z" />
  ),
  frame: <path d="M5 1.8v12.4M11 1.8v12.4M1.8 5h12.4M1.8 11h12.4" />,
  github: (
    <path
      d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.7 1.6.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"
      fill="currentColor"
      stroke="none"
    />
  ),
  globe: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c1.7 1.7 2.5 3.7 2.5 6S9.7 12.3 8 14C6.3 12.3 5.5 10.3 5.5 8S6.3 3.7 8 2z" />
    </>
  ),
  history: (
    <path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8M2.4 2.6v2.6H5M8 5.1v3.1l2.1 1.4" />
  ),
  menu: <path d="M2.5 5.2h11M2.5 10.8h11" />,
  moon: <path d="M13.2 9.7A5.6 5.6 0 0 1 6.3 2.8a5.6 5.6 0 1 0 6.9 6.9z" />,
  move: <path d="M3.2 2.4 13 7.3l-4.3 1.3-1.9 4.3z" />,
  pencil: (
    <>
      <path d="M10.7 2.8a1.6 1.6 0 0 1 2.3 2.3l-7.3 7.3-3 .9.9-3z" />
      <path d="m9.6 3.9 2.3 2.3" />
    </>
  ),
  phone: (
    <>
      <rect height="12.8" rx="1.8" width="7.4" x="4.3" y="1.6" />
      <path d="M7 12.3h2" />
    </>
  ),
  pullRequest: (
    <>
      <circle cx="4" cy="3.6" r="1.6" />
      <circle cx="4" cy="12.4" r="1.6" />
      <circle cx="12" cy="12.4" r="1.6" />
      <path d="M4 5.2v5.6M12 10.8V6.6c0-1.1-.9-2-2-2H7.4M9 3 7.4 4.6 9 6.2" />
    </>
  ),
  replay: <path d="M2.8 8a5.2 5.2 0 1 0 1.5-3.7M2.6 2.4v2.8h2.8" />,
  screen: (
    <>
      <rect height="10.4" rx="1.8" width="12" x="2" y="2.8" />
      <path d="M2 6h12" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.4" />
      <path d="m10.3 10.3 3.3 3.3" />
    </>
  ),
  send: <path d="M8 13V3.4M3.8 7.6 8 3.4l4.2 4.2" />,
  spark: (
    <path
      d="M8 1.2c.5 3.4 1.8 5.4 5.4 6.4-3.6 1-4.9 3-5.4 6.4-.5-3.4-1.8-5.4-5.4-6.4C6.2 6.6 7.5 4.6 8 1.2z"
      fill="currentColor"
      stroke="none"
    />
  ),
  sun: (
    <>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" />
    </>
  ),
  terminal: (
    <>
      <rect height="10.8" rx="1.8" width="12.4" x="1.8" y="2.6" />
      <path d="m4.6 6.2 2 1.8-2 1.8M8.6 9.9h2.8" />
    </>
  ),
  text: <path d="M3 3.4h10M8 3.4v9.4M6.2 12.8h3.6" />,
} as const satisfies Record<string, ReactNode>;
