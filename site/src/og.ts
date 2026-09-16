/**
 * The social card every route publishes: the Mokly mark and wordmark above
 * the page title on the Folio light canvas at 1200×630. The card is drawn as
 * an SVG document here so the drawing can be tested without rasterizing, and
 * `scripts/og.mjs` turns it into the PNG the metadata advertises.
 */

import { PAGE_METADATA, type PageRoute, socialSlug } from "./metadata.js";

/** The card size the Open Graph and Twitter card metadata declares. */
export const CARD_WIDTH = 1200;

/** The card height the Open Graph and Twitter card metadata declares. */
export const CARD_HEIGHT = 630;

/** Folio's light scheme, the only scheme a social card is drawn in. */
const CANVAS = {
  accent: "#176b46",
  ink: "#2d2b27",
  inkMuted: "#67615a",
  line: "#e3dfd8",
  surface: "#fbfaf7",
} as const;

const SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Noto Sans', 'DejaVu Sans', sans-serif";
const DISPLAY = "Georgia, 'Times New Roman', 'Liberation Serif', serif";

const TITLE_SIZE = 76;
const TITLE_LINE = 92;
const MEASURE = 26;

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] ?? character,
  );
}

/**
 * Break the title into at most three lines of roughly `MEASURE` characters.
 * The card is drawn without font metrics, so the measure is deliberately
 * conservative and long words keep their own line rather than overflowing.
 */
export function wrapTitle(title: string): readonly string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of title.trim().split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > MEASURE && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

/**
 * The headline a card shows. Document titles end in the site name, which the
 * card already carries as the wordmark, so the card leads with the page.
 */
export function cardTitle(title: string): string {
  const page = title.replace(/\s·\sMokly$/, "").trim();
  return page.length > 0 ? page : title;
}

/** The card document for one page title. */
export function cardDocument(title: string): string {
  const lines = wrapTitle(cardTitle(title));
  const top = 300 + (3 - lines.length) * 18;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">`,
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${CANVAS.surface}" />`,
    `<rect x="0" y="0" width="${CARD_WIDTH}" height="8" fill="${CANVAS.accent}" />`,
    `<rect x="80" y="${CARD_HEIGHT - 132}" width="${CARD_WIDTH - 160}" height="1" fill="${CANVAS.line}" />`,
    '<g transform="translate(80 92) scale(1.75)">',
    `<rect x="3" y="3" width="20" height="21" rx="4" fill="${CANVAS.accent}" opacity="0.3" />`,
    `<rect x="9" y="8" width="20" height="21" rx="4" fill="${CANVAS.accent}" />`,
    `<path d="M14 15h10M14 20h7" stroke="${CANVAS.surface}" stroke-width="2" stroke-linecap="round" />`,
    "</g>",
    `<text x="150" y="132" font-family="${DISPLAY}" font-size="46" fill="${CANVAS.ink}">mokly<tspan fill="${CANVAS.accent}">.</tspan></text>`,
    ...lines.map(
      (line, index) =>
        `<text x="80" y="${top + index * TITLE_LINE}" font-family="${SANS}" font-size="${TITLE_SIZE}" font-weight="600" letter-spacing="-2" fill="${CANVAS.ink}">${escapeXml(line)}</text>`,
    ),
    `<text x="80" y="${CARD_HEIGHT - 72}" font-family="${SANS}" font-size="28" fill="${CANVAS.inkMuted}">Design in your repository. Decide in the pull request.</text>`,
    "</svg>",
  ].join("");
}

/** Every card the build produces, by the file name it takes. */
export function cards(): ReadonlyMap<string, string> {
  return new Map(
    Object.entries(PAGE_METADATA).map(([route, { title }]) => [
      `${socialSlug(route as PageRoute)}.png`,
      cardDocument(title),
    ]),
  );
}
