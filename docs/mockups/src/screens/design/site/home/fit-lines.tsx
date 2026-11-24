/**
 * The connectors and the open-foundation wire as they fit each width. The
 * 1440px drawings of the Changes connector and of the wire place both ends
 * in pixels of the module; these keep each end on the part it joins at
 * every width:
 *
 * - A connector lives in its module's frame. Its curve stretches between
 *   its two ends, and its start dot and arrowhead keep their size.
 * - The Changes connector runs from the foot of View changes to the
 *   viewer's Changes filter below 1440px. One layout puts the check card
 *   beside the copy, the other stacks it under the copy.
 * - The Browse link line runs from the foot of Continue on the source
 *   screen to the open screen's frame in the viewer, on every width. Its
 *   layouts follow the module's row gap on the desktop composition, and
 *   the phone draws its own.
 * - The wire hangs from the source frame's right edge, because the code
 *   and the artboard both keep their place from that edge. One drawing
 *   joins the 286px artboard, the other the 250px one.
 *
 * The stylesheet shows the drawing that matches each width.
 */

/**
 * The curve of each connector layout, in a box 100 units wide: the box's
 * height, the depth of the turn, and the side of the box that the curve
 * leaves from.
 */
const CONNECTOR_LAYOUTS = {
  "links-narrow": { from: "left", height: 196, turn: 40 },
  "links-phone": { from: "left", height: 201, turn: 48 },
  "links-wide": { from: "left", height: 232, turn: 76 },
  stacked: { from: "right", height: 112, turn: 30 },
  wide: { from: "right", height: 148, turn: 66 },
} as const;

/** A connector between two parts of a module, for one layout. */
export function FitConnector({
  layout,
}: {
  layout: keyof typeof CONNECTOR_LAYOUTS;
}) {
  const { from, height, turn } = CONNECTOR_LAYOUTS[layout];
  const [start, end] = from === "right" ? [100, 0] : [0, 100];
  const bend = turn / 2;
  const path = `M${start} 0 C${start} ${bend}, ${end} ${bend}, ${end} ${turn} L${end} ${height}`;
  return (
    <span
      aria-hidden="true"
      className={`site-home-fit-connector site-home-fit-connector--${layout}`}
    >
      <svg
        className="site-home-fit-connector-curve"
        focusable="false"
        preserveAspectRatio="none"
        viewBox={`0 0 100 ${height}`}
      >
        <path className="site-home-connector-halo" d={path} />
        <path className="site-home-connector-path" d={path} />
      </svg>
      <svg
        className="site-home-fit-connector-start"
        focusable="false"
        viewBox="0 0 12 12"
      >
        <circle className="site-home-connector-start" cx="6" cy="6" r="4" />
      </svg>
      <svg
        className="site-home-fit-connector-head"
        focusable="false"
        viewBox="0 0 12 9"
      >
        <path className="site-home-connector-path" d="M1 1 L6 8 L11 1" />
      </svg>
    </span>
  );
}

/**
 * Each wire, in a 400px box at the source frame's right edge: it leaves
 * line 11 of the code and lands on the selected PriceCard.
 */
const WIRES = {
  large: { from: { x: 18, y: 311 }, to: { x: 125.7, y: 293.8 } },
  small: { from: { x: 86, y: 311 }, to: { x: 159.8, y: 303.2 } },
} as const;

/** The wire from the PriceCard's lines to the card, for one artboard size. */
export function FitWire({ size }: { size: keyof typeof WIRES }) {
  const { from, to } = WIRES[size];
  const reach = (to.x - from.x) / 2;
  return (
    <svg
      aria-hidden="true"
      className={`site-home-fit-wire site-home-fit-wire--${size}`}
      focusable="false"
    >
      <path
        className="site-home-wire-path"
        d={`M${from.x} ${from.y} C ${from.x + reach} ${from.y}, ${to.x - reach} ${to.y}, ${to.x} ${to.y}`}
      />
      <circle className="site-home-wire-end" cx={from.x} cy={from.y} r="3.5" />
      <circle className="site-home-wire-end" cx={to.x} cy={to.y} r="3.5" />
    </svg>
  );
}
