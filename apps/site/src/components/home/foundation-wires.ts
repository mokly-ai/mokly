/**
 * The wires of the open-foundation frame, which join line 11 of the source
 * in the code panel to the selected PriceCard on the artboard, as the
 * open-foundation mockup draws them. Each wire is a curve that leaves the
 * code level and lands level on the card, with a dot at each end.
 *
 * - The wide wire is the 1440px drawing. It places both ends in pixels of
 *   the frame, which is 1080px wide wherever that drawing shows.
 * - The fit wires take over below 1440px, where the frame narrows. Each
 *   hangs in a 400px box at the frame's right edge, because the code and
 *   the artboard keep their places from that edge: `large` joins the 286px
 *   artboard and `small` the 250px one.
 *
 * `src/styles/home-foundation.css` shows the drawing that fits each width,
 * and its demo reveals each wire from one end dot to the other, so its clip
 * values follow these ends.
 */

/** A point of a wire, in pixels of the box that draws it. */
export interface WirePoint {
  readonly x: number;
  readonly y: number;
}

/** A wire: the end on the source line and the end on the card. */
export interface Wire {
  readonly from: WirePoint;
  readonly to: WirePoint;
}

/** The radius of each end dot, in pixels. */
export const WIRE_END_RADIUS = 3.5;

/** The 1440px wire, in pixels of the frame. */
export const WIDE_WIRE: Wire = {
  from: { x: 698, y: 311 },
  to: { x: 806, y: 294 },
};

/** The size of each fit wire, by the width of the artboard it joins. */
export type FitWireSize = "large" | "small";

/** The fit wires, in pixels of their 400px box at the frame's right edge. */
export const FIT_WIRES: Readonly<Record<FitWireSize, Wire>> = {
  large: { from: { x: 18, y: 311 }, to: { x: 125.7, y: 293.8 } },
  small: { from: { x: 86, y: 311 }, to: { x: 159.8, y: 303.2 } },
};

/**
 * The SVG path of a wire: a cubic curve whose control points sit halfway
 * across, level with each end, so it leaves and lands horizontally.
 */
export function wirePath({ from, to }: Wire): string {
  const reach = (to.x - from.x) / 2;
  return `M${from.x} ${from.y} C ${from.x + reach} ${from.y}, ${to.x - reach} ${to.y}, ${to.x} ${to.y}`;
}
