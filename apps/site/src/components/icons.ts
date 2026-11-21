/**
 * The Canvas icon set: the line icons of the design file's tool voice, drawn
 * on a 16px grid with a 1.5px stroke in the current colour, so the site's
 * roles decide every stroke. `Icon.astro` draws one. Each entry is the inside
 * of the 16×16 SVG, copied from the drawings of the site mockups.
 */

/** Every Canvas icon the site draws, by name. */
export const ICONS = {
  branch:
    '<circle cx="4.5" cy="3.6" r="1.6" /><circle cx="4.5" cy="12.4" r="1.6" /><circle cx="11.5" cy="5.4" r="1.6" /><path d="M4.5 5.2v5.6M11.5 7c0 2.6-2.4 3.3-5.6 4" />',
  close: '<path d="m4 4 8 8M12 4l-8 8" />',
  file: '<path d="M4 1.9h5l3.1 3.1v8c0 .6-.5 1.1-1.1 1.1H4c-.6 0-1.1-.5-1.1-1.1V3c0-.6.5-1.1 1.1-1.1z" /><path d="M9 1.9V5h3.1" />',
  frame: '<path d="M5 1.8v12.4M11 1.8v12.4M1.8 5h12.4M1.8 11h12.4" />',
  menu: '<path d="M2.5 5.2h11M2.5 10.8h11" />',
  moon: '<path d="M13.2 9.7A5.6 5.6 0 0 1 6.3 2.8a5.6 5.6 0 1 0 6.9 6.9z" />',
  spark:
    '<path d="M8 1.2c.5 3.4 1.8 5.4 5.4 6.4-3.6 1-4.9 3-5.4 6.4-.5-3.4-1.8-5.4-5.4-6.4C6.2 6.6 7.5 4.6 8 1.2z" fill="currentColor" stroke="none" />',
  sun: '<circle cx="8" cy="8" r="2.8" /><path d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" />',
} as const;

/** The name of one icon of the Canvas icon set. */
export type IconName = keyof typeof ICONS;
