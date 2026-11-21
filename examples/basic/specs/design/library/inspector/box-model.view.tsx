import type { BoxModelProps } from "./box-model.js";

/** The padding in words: one number when the sides agree, or each side. */
function paddingWords({ bottom, left, right, top }: BoxModelProps): string {
  if (top === right && right === bottom && bottom === left)
    return `Padding ${top} on every side`;
  if (top === bottom && left === right)
    return `Padding ${top} top and bottom, ${left} left and right`;
  return `Padding ${top} top, ${right} right, ${bottom} bottom, ${left} left`;
}

/**
 * The selected instance's box model: the padding of each side on a hatched
 * band around the content box, which names the content size. The drawing is
 * one image whose name gives the same numbers in words.
 */
export function BoxModelView(props: BoxModelProps) {
  const { bottom, height, left, right, top, width } = props;
  return (
    <div
      aria-label={`${paddingWords(props)}. Content ${width} by ${height}.`}
      className="cv-boxm"
      role="img"
    >
      <span className="cv-boxm-side" data-side="top">
        {top}
      </span>
      <span className="cv-boxm-side" data-side="left">
        {left}
      </span>
      <span className="cv-boxm-content">
        {width} × {height}
      </span>
      <span className="cv-boxm-side" data-side="right">
        {right}
      </span>
      <span className="cv-boxm-side" data-side="bottom">
        {bottom}
      </span>
    </div>
  );
}
