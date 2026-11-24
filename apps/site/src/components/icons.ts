/**
 * The Canvas icon set: the line icons of the design file's tool voice, drawn
 * on a 16px grid with a 1.5px stroke in the current colour, so the site's
 * roles decide every stroke. `Icon.astro` draws one. Each entry is the inside
 * of the icon's SVG, copied from the drawings of the site mockups: the chrome
 * and canvas icons and the pages' own icons, in one list sorted by name, so a
 * page draws any icon of the set without adding one. `github` is the one
 * drawing on another grid, which `VIEW_BOXES` gives.
 */

/** Every Canvas icon, by name. */
export const ICONS = {
  agent:
    '<path d="M8 1.9c.5 3 1.6 4.7 4.6 5.6-3 .9-4.1 2.6-4.6 5.6-.5-3-1.6-4.7-4.6-5.6 3-.9 4.1-2.6 4.6-5.6z" /><path d="M12.6 1.8v2.6M11.3 3.1h2.6" />',
  alert:
    '<path d="M7.1 2.7a1 1 0 0 1 1.8 0l5.2 9.5a1 1 0 0 1-.9 1.5H2.8a1 1 0 0 1-.9-1.5z" /><path d="M8 6.4v3M8 11.5h.01" />',
  arrowLeft: '<path d="M13.2 8H2.8M6.8 4l-4 4 4 4" />',
  arrowRight: '<path d="M2.8 8h10.4M9.2 4l4 4-4 4" />',
  bolt: '<path d="M8.9 1.7 3.4 9.1h4.1l-.9 5.2 6-7.6H8.4z" />',
  branch:
    '<circle cx="4.5" cy="3.6" r="1.6" /><circle cx="4.5" cy="12.4" r="1.6" /><circle cx="11.5" cy="5.4" r="1.6" /><path d="M4.5 5.2v5.6M11.5 7c0 2.6-2.4 3.3-5.6 4" />',
  calendar:
    '<rect height="10.6" rx="1.6" width="11.6" x="2.2" y="3" /><path d="M2.2 6.4h11.6M5.4 1.8v2.4M10.6 1.8v2.4" />',
  card: '<rect height="9.2" rx="1.6" width="12.4" x="1.8" y="3.4" /><path d="M1.8 6.6h12.4M4.4 10h2.6" />',
  caret: '<path d="m6.2 4.4 3.6 3.6-3.6 3.6" />',
  check: '<path d="m3.4 8.4 3 3 6.2-6.8" />',
  checkCircle:
    '<circle cx="8" cy="8" r="6.2" /><path d="m5.3 8.2 1.9 1.9 3.6-4" />',
  chevronDown: '<path d="m4.5 6.3 3.5 3.5 3.5-3.5" />',
  close: '<path d="m4 4 8 8M12 4l-8 8" />',
  comment:
    '<path d="M8 2.3c3.2 0 5.7 2.2 5.7 5s-2.5 5-5.7 5c-.8 0-1.6-.1-2.3-.4l-3.2 1.2.9-2.6C2.7 9.6 2.3 8.5 2.3 7.3c0-2.8 2.5-5 5.7-5z" />',
  commit: '<circle cx="8" cy="8" r="2.5" /><path d="M1.5 8h4M10.5 8h4" />',
  component:
    '<path d="M8 1.6 10.1 3.7 8 5.8 5.9 3.7zM8 10.2l2.1 2.1L8 14.4l-2.1-2.1zM3.7 5.9 5.8 8l-2.1 2.1L1.6 8zM12.3 5.9 14.4 8l-2.1 2.1L10.2 8z" />',
  copy: '<rect height="8.4" rx="1.6" width="8.4" x="5.2" y="5.2" /><path d="M10.8 5.2V3.6c0-.6-.5-1.1-1.1-1.1H3.6c-.6 0-1.1.5-1.1 1.1v6.1c0 .6.5 1.1 1.1 1.1h1.6" />',
  cube: '<path d="m8 1.8 5.6 3.1v6.2L8 14.2l-5.6-3.1V4.9z" /><path d="m2.4 4.9 5.6 3.1 5.6-3.1M8 8v6.2" />',
  desktop:
    '<rect height="8.6" rx="1.5" width="12.4" x="1.8" y="2.4" /><path d="M5.6 13.8h4.8M8 11v2.8" />',
  doc: '<path d="M4 1.9h5l3.1 3.1v8c0 .6-.5 1.1-1.1 1.1H4c-.6 0-1.1-.5-1.1-1.1V3c0-.6.5-1.1 1.1-1.1z" /><path d="M9 1.9V5h3.1M5.4 8.3h5.2M5.4 10.9h3.4" />',
  down: '<path d="M8 3v9.8M4.2 9 8 12.8 11.8 9" />',
  download: '<path d="M8 2.4v7.8M4.7 7 8 10.3 11.3 7M3 13.2h10" />',
  end: '<circle cx="8" cy="8" r="6" /><path d="M5.6 8h4.8" />',
  enter:
    '<path d="M12.8 3.2v4.6c0 .9-.7 1.6-1.6 1.6H3.4M6.2 6.6 3.4 9.4l2.8 2.8" />',
  external:
    '<path d="M9.4 2.8h3.8v3.8M13.2 2.8 7.6 8.4M11.8 9.4v2.9c0 .6-.5 1-1 1H3.8c-.6 0-1-.4-1-1V5.3c0-.6.4-1 1-1h2.9" />',
  feature:
    '<rect height="11.4" rx="3" width="11.4" x="2.3" y="2.3" /><path d="M8 5.4v5.2M5.4 8h5.2" />',
  feed: '<path d="M3.2 2.8a10 10 0 0 1 10 10M3.2 7a5.8 5.8 0 0 1 5.8 5.8" /><circle cx="3.9" cy="12.1" r="1.1" />',
  file: '<path d="M4 1.9h5l3.1 3.1v8c0 .6-.5 1.1-1.1 1.1H4c-.6 0-1.1-.5-1.1-1.1V3c0-.6.5-1.1 1.1-1.1z" /><path d="M9 1.9V5h3.1" />',
  fix: '<path d="M9.8 4.2a.67.67 0 0 0 0 .93l1.07 1.07a.67.67 0 0 0 .93 0l2.51-2.51a4 4 0 0 1-5.29 5.29l-4.6 4.6a1.41 1.41 0 0 1-2-2l4.6-4.6a4 4 0 0 1 5.29-5.29z" />',
  folder:
    '<path d="M1.9 4.3c0-.7.5-1.2 1.2-1.2H6l1.5 1.6h5.4c.7 0 1.2.5 1.2 1.2v6c0 .7-.5 1.2-1.2 1.2H3.1c-.7 0-1.2-.5-1.2-1.2z" />',
  frame: '<path d="M5 1.8v12.4M11 1.8v12.4M1.8 5h12.4M1.8 11h12.4" />',
  github:
    '<path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.7 1.6.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" fill="currentColor" stroke="none" />',
  globe:
    '<circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c1.7 1.7 2.5 3.7 2.5 6S9.7 12.3 8 14C6.3 12.3 5.5 10.3 5.5 8S6.3 3.7 8 2z" />',
  hash: '<path d="M6.4 2.6 5 13.4M11.2 2.6 9.8 13.4M2.9 5.9h10.6M2.5 10.1h10.6" />',
  history:
    '<path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8M2.4 2.6v2.6H5M8 5.1v3.1l2.1 1.4" />',
  inspect:
    '<path d="M2.4 4.4h3.4M9 4.4h4.6M2.4 11.6h6.2M11.8 11.6h1.8" /><circle cx="7.4" cy="4.4" r="1.6" /><circle cx="10.2" cy="11.6" r="1.6" />',
  layers:
    '<path d="M8 2.1 14 5.2 8 8.3 2 5.2z" /><path d="m2 8 6 3.1L14 8M2 10.8l6 3.1 6-3.1" />',
  lock: '<rect height="6.6" rx="1.6" width="9.6" x="3.2" y="7.2" /><path d="M5.4 7.2V5.4a2.6 2.6 0 0 1 5.2 0v1.8" />',
  menu: '<path d="M2.5 5.2h11M2.5 10.8h11" />',
  moon: '<path d="M13.2 9.7A5.6 5.6 0 0 1 6.3 2.8a5.6 5.6 0 1 0 6.9 6.9z" />',
  move: '<path d="M3.2 2.4 13 7.3l-4.3 1.3-1.9 4.3z" />',
  outline: '<path d="M2.6 4h.8M6 4h7.4M2.6 8h.8M6 8h7.4M2.6 12h.8M6 12h7.4" />',
  pencil:
    '<path d="M10.7 2.8a1.6 1.6 0 0 1 2.3 2.3l-7.3 7.3-3 .9.9-3z" /><path d="m9.6 3.9 2.3 2.3" />',
  phone:
    '<rect height="12.8" rx="1.8" width="7.4" x="4.3" y="1.6" /><path d="M7 12.3h2" />',
  pullRequest:
    '<circle cx="4" cy="3.6" r="1.6" /><circle cx="4" cy="12.4" r="1.6" /><circle cx="12" cy="12.4" r="1.6" /><path d="M4 5.2v5.6M12 10.8V6.6c0-1.1-.9-2-2-2H7.4M9 3 7.4 4.6 9 6.2" />',
  receipt:
    '<path d="M3.5 1.9h9v12.2l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z" /><path d="M5.8 5.4h4.4M5.8 8.2h4.4" />',
  replay: '<path d="M2.8 8a5.2 5.2 0 1 0 1.5-3.7M2.6 2.4v2.8h2.8" />',
  screen:
    '<rect height="10.4" rx="1.8" width="12" x="2" y="2.8" /><path d="M2 6h12" />',
  search: '<circle cx="7" cy="7" r="4.4" /><path d="m10.3 10.3 3.3 3.3" />',
  send: '<path d="M8 13V3.4M3.8 7.6 8 3.4l4.2 4.2" />',
  spark:
    '<path d="M8 1.2c.5 3.4 1.8 5.4 5.4 6.4-3.6 1-4.9 3-5.4 6.4-.5-3.4-1.8-5.4-5.4-6.4C6.2 6.6 7.5 4.6 8 1.2z" fill="currentColor" stroke="none" />',
  sun: '<circle cx="8" cy="8" r="2.8" /><path d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" />',
  tag: '<path d="M2.3 7.4v-4c0-.6.5-1.1 1.1-1.1h4c.3 0 .6.1.8.3l5.5 5.5c.4.4.4 1.1 0 1.6l-4 4c-.4.4-1.1.4-1.6 0L2.6 8.2c-.2-.2-.3-.5-.3-.8z" /><circle cx="5.3" cy="5.3" r=".9" />',
  terminal:
    '<rect height="10.8" rx="1.8" width="12.4" x="1.8" y="2.6" /><path d="m4.6 6.2 2 1.8-2 1.8M8.6 9.9h2.8" />',
  text: '<path d="M3 3.4h10M8 3.4v9.4M6.2 12.8h3.6" />',
  up: '<path d="M8 13V3.2M4.2 7 8 3.2 11.8 7" />',
  users:
    '<circle cx="6" cy="5.6" r="2.3" /><path d="M1.8 13.4c.5-2.4 2.2-3.8 4.2-3.8s3.7 1.4 4.2 3.8" /><path d="M10.2 3.5a2.3 2.3 0 0 1 0 4.3M12 9.9c1.2.6 1.9 1.8 2.2 3.5" />',
} as const;

/** The name of one icon of the Canvas icon set. */
export type IconName = keyof typeof ICONS;

/** The view box of each drawing that is not on the 16px grid. */
export const VIEW_BOXES: Readonly<Partial<Record<IconName, string>>> = {
  github: "0 0 24 24",
};
