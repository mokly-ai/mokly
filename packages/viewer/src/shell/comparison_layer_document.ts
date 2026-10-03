/** Read and scroll the presented document inside one comparison layer. */

import {
  scrollInstantly,
  type ScrollOffset,
} from "./comparison_scroll_mirror.js";

function scroller(doc: Document): Element | null {
  return doc.scrollingElement ?? doc.documentElement;
}

/** How far a document scrolls beyond its frame on each axis. */
export function documentRange(doc: Document): ScrollOffset {
  const root = scroller(doc);
  if (!root) return { x: 0, y: 0 };
  return {
    x: Math.max(0, root.scrollWidth - root.clientWidth),
    y: Math.max(0, root.scrollHeight - root.clientHeight),
  };
}

/** A document's current scroll offset. */
export function documentOffset(doc: Document): ScrollOffset {
  const root = scroller(doc);
  return root ? { x: root.scrollLeft, y: root.scrollTop } : { x: 0, y: 0 };
}

/**
 * Scroll a document towards an offset at once, whatever its CSS
 * `scroll-behavior`; it stops at its own end.
 */
export function scrollDocument(
  doc: Document,
  offset: ScrollOffset,
): ScrollOffset {
  const root = scroller(doc);
  if (!root) return { x: 0, y: 0 };
  scrollInstantly(root, offset);
  return documentOffset(doc);
}

function transparent(colour: string): boolean {
  return (
    colour === "" || colour === "transparent" || /[,/]\s*0\)$/.test(colour)
  );
}

/**
 * The colour the document paints on its canvas: the root element's computed
 * background, or the body's when the root's is transparent, as CSS canvas
 * propagation does. An empty string means the document paints none.
 */
export function canvasColour(doc: Document): string {
  const view = doc.defaultView;
  if (!view || !doc.documentElement) return "";
  const root = view.getComputedStyle(doc.documentElement).backgroundColor;
  if (!transparent(root)) return root;
  const body = doc.body ? view.getComputedStyle(doc.body).backgroundColor : "";
  return transparent(body) ? "" : body;
}
