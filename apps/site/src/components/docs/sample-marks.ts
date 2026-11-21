/**
 * The drawing of a lit pair in an HTML sample band: the mark over the lit
 * element in its view, and the wire from the lit line to that element. The
 * sample island, `sample-island.ts`, measures the band and calls these to
 * place the parts that `src/docs/sample-stage.ts` draws. Every length is in
 * CSS pixels of the page. Nothing here animates.
 */

/** A point in the stage's space. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A box in its document's viewport, as `getBoundingClientRect()` gives it. */
export interface Box {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

/** The room above and below the wire's curve for its stroke. */
const STROKE_ROOM = 1;

/** A length for a style, rounded to a hundredth of a pixel. */
function pixels(value: number): string {
  return `${Math.round(value * 100) / 100}px`;
}

/** A number for an attribute, rounded to a hundredth. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The box of an element in its view's document. It hugs the element's
 * content, as the design file's selection of a text layer does, and falls
 * back to the element's own box when the content draws nothing, such as an
 * image's. An element without a box, such as a template, has none.
 */
export function contentBox(element: Element): Box | undefined {
  if (element.getClientRects().length === 0) return undefined;
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  const content = range.getBoundingClientRect();
  return content.width > 0 && content.height > 0
    ? content
    : element.getBoundingClientRect();
}

/** Whether any of a box shows in the viewport of its view's frame. */
export function inView(box: Box, frame: HTMLIFrameElement): boolean {
  return (
    box.left + box.width > 0 &&
    box.top + box.height > 0 &&
    box.left < frame.offsetWidth &&
    box.top < frame.offsetHeight
  );
}

/**
 * Place a mark over a box of its view's document, which the frame shows at
 * `scale`, and name the element's tag in its tag.
 */
export function placeMark(
  mark: HTMLElement,
  box: Box,
  scale: number,
  tag: string,
): void {
  mark.style.left = pixels(box.left * scale);
  mark.style.top = pixels(box.top * scale);
  mark.style.width = pixels(box.width * scale);
  mark.style.height = pixels(box.height * scale);
  const name = mark.querySelector(".site-docs-sample-tag");
  if (name) name.textContent = tag;
  mark.hidden = false;
}

/** Centre one end of the wire on a point of the wire's box. */
function placeEnd(end: HTMLElement | null, left: number, top: number): void {
  if (!end) return;
  end.style.left = pixels(left);
  end.style.top = pixels(top);
}

/**
 * Draw a wire from a lit line to its element: a curve that leaves `from`
 * level and reaches `to` level, with a dot at each end.
 */
export function placeWire(wire: HTMLElement, from: Point, to: Point): void {
  const top = Math.min(from.y, to.y) - STROKE_ROOM;
  const width = round(Math.max(0, to.x - from.x));
  const height = round(Math.abs(to.y - from.y) + 2 * STROKE_ROOM);
  const start = round(from.y - top);
  const end = round(to.y - top);
  const middle = round(width / 2);
  wire.style.left = pixels(from.x);
  wire.style.top = pixels(top);
  wire.style.width = pixels(width);
  wire.style.height = pixels(height);
  const drawing = wire.querySelector("svg");
  drawing?.setAttribute("width", String(width));
  drawing?.setAttribute("height", String(height));
  drawing?.setAttribute("viewBox", `0 0 ${width} ${height}`);
  drawing
    ?.querySelector("path")
    ?.setAttribute(
      "d",
      `M0 ${start}C${middle} ${start} ${middle} ${end} ${width} ${end}`,
    );
  placeEnd(wire.querySelector(".site-docs-sample-end--source"), 0, start);
  placeEnd(wire.querySelector(".site-docs-sample-end--element"), width, end);
  wire.hidden = false;
}
