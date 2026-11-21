/**
 * Mokly's brand mark, the selected layer of a design file: an outline frame
 * behind a filled front layer that carries two short rules, on a 32-unit
 * grid. The outline and the front layer take `currentColor`. The top bar's
 * stylesheet paints the outline through `mbk-mark-back`, the halo that
 * `mbk-mark-front` strokes under the front layer's fill to part it from the
 * frame, and the rules through `mbk-mark-rules`.
 */
export function BrandIcon(props: { size?: number }) {
  const size = props.size ?? 22;
  return (
    <svg
      aria-hidden="true"
      className="mbk-reset"
      height={size}
      viewBox="0 0 32 32"
      width={size}
    >
      <rect
        className="mbk-mark-back"
        fill="none"
        height={19.8}
        rx={4.6}
        stroke="currentColor"
        strokeWidth={1.8}
        width={18.8}
        x={3.6}
        y={3.6}
      />
      <rect
        className="mbk-mark-front"
        fill="currentColor"
        height={21}
        paintOrder="stroke"
        rx={4.8}
        strokeWidth={1.6}
        width={20}
        x={9}
        y={8}
      />
      <path
        className="mbk-mark-rules"
        d="M14 15h10M14 20h7"
        fill="none"
        strokeLinecap="round"
        strokeWidth={2.1}
      />
    </svg>
  );
}
