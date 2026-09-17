// The status band the phone chrome reserves above every embedded mobile
// fragment: a clock to the left of the notch, and cellular, Wi-Fi, and battery
// glyphs to its right. These glyphs keep their own viewBoxes and fill their
// shapes because the row is sized in device pixels, unlike the stroked 24-unit
// navigation icons in `icons.tsx`.

/** Ascending cellular signal bars. */
function CellularGlyph() {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={11}
      viewBox="0 0 18 12"
      width={16}
    >
      <rect height={4} rx={1} width={3} x={0} y={8} />
      <rect height={6.5} rx={1} width={3} x={5} y={5.5} />
      <rect height={9} rx={1} width={3} x={10} y={3} />
      <rect height={11.5} rx={1} width={3} x={15} y={0.5} />
    </svg>
  );
}

/** Wi-Fi arcs rising from a connection dot. */
function WifiGlyph() {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={11}
      viewBox="0 0 16 12"
      width={16}
    >
      <path d="M8 11.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0-4.8c1.4 0 2.7.5 3.7 1.4l1.4-1.4A8 8 0 0 0 8 4.4a8 8 0 0 0-5.1 1.8l1.4 1.4A5.7 5.7 0 0 1 8 6.4ZM2.2 4.6 .8 3.2A11 11 0 0 1 8 .4a11 11 0 0 1 7.2 2.8l-1.4 1.4A9 9 0 0 0 8 2.4a9 9 0 0 0-5.8 2.2Z" />
    </svg>
  );
}

/** A part-charged battery with its contact nub. */
function BatteryGlyph() {
  return (
    <svg aria-hidden="true" height={11} viewBox="0 0 24 12" width={22}>
      <rect
        fill="none"
        height={10}
        rx={2.5}
        stroke="currentColor"
        width={20}
        x={1}
        y={1}
      />
      <rect fill="currentColor" height={4} rx={0.6} width={1.6} x={22} y={4} />
      <rect
        fill="currentColor"
        height={6.8}
        rx={1.4}
        width={14}
        x={2.8}
        y={2.6}
      />
    </svg>
  );
}

/** The clock, signal, Wi-Fi, and battery row reserved above a mobile screen. */
export function PhoneStatusBar() {
  return (
    <div className="phone-status">
      <span>9:41</span>
      <span className="phone-status-icons">
        <CellularGlyph />
        <WifiGlyph />
        <BatteryGlyph />
      </span>
    </div>
  );
}
