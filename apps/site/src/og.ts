/**
 * The social card every route publishes, in the Canvas light look at
 * 1200×630: the light lockup on the dot-grid canvas, the page title in a
 * selected frame with its handles and size tag, and the home hero heading
 * below it. The card is drawn as an SVG document here so the drawing can be
 * tested without rasterizing, and `scripts/og.mjs` turns it into the PNG the
 * metadata advertises. The rasterizer loads no web font, so the card draws
 * the mark and the outlined wordmark of the published light lockup, and its
 * text takes system stacks.
 */

import { readFileSync } from "node:fs";

import { tokens } from "@mokly-cloud/tokens/tokens";

import { DOCS_PAGES } from "./docs/pages.js";
import { HOME_HERO } from "./home.js";
import { PAGE_METADATA, type PageRoute, socialSlug } from "./metadata.js";
import { sitePath } from "./workspace.js";

/** The card size the Open Graph and Twitter card metadata declares. */
export const CARD_WIDTH = 1200;

/** The card height the Open Graph and Twitter card metadata declares. */
export const CARD_HEIGHT = 630;

/** The published light lockup, whose mark and outlined wordmark a card draws. */
export const LIGHT_LOCKUP = sitePath("public", "brand", "mokly-logo-light.svg");

/** Canvas's light scheme, the only scheme a social card is drawn in. */
const CANVAS = {
  background: tokens.color.light.background,
  border: tokens.color.light.border,
  dot: tokens.color.light.dot,
  onSignal: tokens.color.light.onSignal,
  signal: tokens.color.light.signal,
  surface: tokens.color.light.surface,
  text: tokens.color.light.text,
  textMuted: tokens.color.light.textMuted,
} as const;

/** Neo-grotesque system faces, the nearest installed kin of Geist. */
const SANS =
  "'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', 'Nimbus Sans', 'DejaVu Sans', sans-serif";
const MONO =
  "ui-monospace, 'SFMono-Regular', Menlo, 'Liberation Mono', 'DejaVu Sans Mono', monospace";

/** The selected frame that holds the title, its handles and its size tag. */
const FRAME = { x: 80, y: 150, width: 1040, height: 304 } as const;
const HANDLE = 12;
const TAG = { width: 124, height: 28, gap: 12 } as const;

const TITLE_SIZE = 64;
const TITLE_LINE = 78;
const TITLE_INSET = 48;
const CAP_HEIGHT = 0.72;
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
 * The light lockup as a nested drawing at one place and width on the card.
 * Only the lockup's root element changes: its view box stays, so the mark and
 * the outlined wordmark scale as one.
 */
function lockupDrawing(x: number, y: number, width: number): string {
  const source = readFileSync(LIGHT_LOCKUP, "utf8").trim();
  const root = /^<svg\b[^>]*>/.exec(source)?.[0];
  const box = root && /\bviewBox="(0 0 (\d+) (\d+))"/.exec(root);
  if (!root || !box)
    throw new Error(
      `${LIGHT_LOCKUP} must start with an svg element that has a view box`,
    );
  const height = (width * Number(box[3])) / Number(box[2]);
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${box[1]}">${source.slice(root.length)}`;
}

const LOCKUP = lockupDrawing(67.5, 40, 240);

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

/** The dot-grid canvas, the background with a dot on a 24px pitch. */
function canvas(): string {
  return [
    '<defs><pattern id="card-dots" width="24" height="24" patternUnits="userSpaceOnUse">',
    `<circle cx="12" cy="12" r="1.5" fill="${CANVAS.dot}" /></pattern></defs>`,
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${CANVAS.background}" />`,
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#card-dots)" />`,
  ].join("");
}

/** The frame as a selected layer: its outline, four handles and a size tag. */
function selection(): string {
  const { x, y, width, height } = FRAME;
  const corners: readonly (readonly [number, number])[] = [
    [x, y],
    [x + width, y],
    [x, y + height],
    [x + width, y + height],
  ];
  const tagX = x + (width - TAG.width) / 2;
  const tagY = y + height + TAG.gap;
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="${CANVAS.surface}" stroke="${CANVAS.border}" />`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${CANVAS.signal}" stroke-width="2" />`,
    ...corners.map(
      ([cornerX, cornerY]) =>
        `<rect x="${cornerX - HANDLE / 2}" y="${cornerY - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="${CANVAS.surface}" stroke="${CANVAS.signal}" stroke-width="2" />`,
    ),
    `<rect x="${tagX}" y="${tagY}" width="${TAG.width}" height="${TAG.height}" rx="4" fill="${CANVAS.signal}" />`,
    `<text x="${tagX + TAG.width / 2}" y="${tagY + 19}" text-anchor="middle" font-family="${MONO}" font-size="15" font-weight="600" fill="${CANVAS.onSignal}">${width} × ${height}</text>`,
  ].join("");
}

/** The card document for one page title. */
export function cardDocument(title: string): string {
  const lines = wrapTitle(cardTitle(title));
  // Centre the lines in the frame from the first line's cap top to the last
  // line's baseline.
  const block = TITLE_SIZE * CAP_HEIGHT + (lines.length - 1) * TITLE_LINE;
  const firstBaseline =
    FRAME.y + (FRAME.height - block) / 2 + TITLE_SIZE * CAP_HEIGHT;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">`,
    canvas(),
    LOCKUP,
    selection(),
    ...lines.map(
      (line, index) =>
        `<text x="${FRAME.x + TITLE_INSET}" y="${firstBaseline + index * TITLE_LINE}" font-family="${SANS}" font-size="${TITLE_SIZE}" font-weight="600" letter-spacing="-1" fill="${CANVAS.text}">${escapeXml(line)}</text>`,
    ),
    `<text x="${FRAME.x}" y="${CARD_HEIGHT - 56}" font-family="${SANS}" font-size="28" fill="${CANVAS.textMuted}">${escapeXml(HOME_HERO.heading)}</text>`,
    "</svg>",
  ].join("");
}

/** The document title of one documentation page. */
export function docsTitle(title: string): string {
  return `${title} · Mokly`;
}

/** Every card the build produces, by the file name it takes. */
export function cards(): ReadonlyMap<string, string> {
  return new Map([
    ...Object.entries(PAGE_METADATA).map(
      ([route, { title }]): [string, string] => [
        `${socialSlug(route as PageRoute)}.png`,
        cardDocument(title),
      ],
    ),
    ...DOCS_PAGES.map((page): [string, string] => [
      `${socialSlug(page.route)}.png`,
      cardDocument(docsTitle(page.title)),
    ]),
  ]);
}
