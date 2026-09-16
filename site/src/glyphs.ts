/**
 * The line glyphs the home's framed catalogue and its feature details draw.
 * They mirror the catalogue shell's own icon set so the depicted product
 * reads as the same tool, and they inherit color so the tokens decide every
 * stroke. Each entry is the inside of a 24×24 stroked SVG.
 */

/** Every glyph the site draws, by name. */
export const GLYPHS = {
  chevron: '<polyline points="9 6 15 12 9 18" />',
  collection:
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
  component:
    '<path d="m8 1 6 3.5v7L8 15l-6-3.5v-7L8 1Zm0 7 6-3.5M8 8v7M8 8 2 4.5" />',
  flow: '<rect height="6" rx="1.5" width="7" x="2" y="4" /><rect height="6" rx="1.5" width="7" x="15" y="14" /><path d="M9 7h5a2 2 0 0 1 2 2v5" />',
  mark: '<path d="M6.5 5.5V5a2 2 0 0 1 2-2H20a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2h-8" stroke-linecap="butt" /><rect height="13" rx="1.75" width="8.5" x="1.5" y="7" />',
  page: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />',
  screen:
    '<rect height="16" rx="2" width="18" x="3" y="4" /><path d="M3 9h18" />',
  search: '<circle cx="11" cy="11" r="7" /><path d="M20 20l-3.9-3.9" />',
  send: '<path d="M12 20V5" /><polyline points="6 11 12 5 18 11" />',
  tag: '<path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.2" />',
} as const;

/** One of the glyphs the site can draw. */
export type GlyphName = keyof typeof GLYPHS;

/** The default size, in pixels, each glyph is drawn at. */
export const GLYPH_SIZES: Readonly<Record<GlyphName, number>> = {
  chevron: 12,
  collection: 13,
  component: 13,
  flow: 13,
  mark: 15,
  page: 13,
  screen: 13,
  search: 14,
  send: 12,
  tag: 13,
};
