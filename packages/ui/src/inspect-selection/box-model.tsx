/**
 * The selected instance's box model: the padding of each side on a hatched
 * band around the content box, which names the content size. The drawing is
 * one image whose accessible name gives the same numbers in words.
 */

/** The padding of each side and the content size, in whole CSS pixels. */
export interface BoxModelSizes {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

/** The padding in words: one number when the sides agree, or each side. */
function paddingWords({ bottom, left, right, top }: BoxModelSizes): string {
  if (top === right && right === bottom && bottom === left)
    return `Padding ${top} on every side`;
  if (top === bottom && left === right)
    return `Padding ${top} top and bottom, ${left} left and right`;
  return `Padding ${top} top, ${right} right, ${bottom} bottom, ${left} left`;
}

/** The accessible name of the drawing, such as `Padding 10 left and right…`. */
export function boxModelWords(sizes: BoxModelSizes): string {
  return `${paddingWords(sizes)}. Content ${sizes.width} by ${sizes.height}.`;
}

export function BoxModel({ sizes }: { sizes: BoxModelSizes }) {
  const { bottom, height, left, right, top, width } = sizes;
  return (
    <div
      aria-label={boxModelWords(sizes)}
      className="mbk-box-model mbk-reset"
      role="img"
    >
      <span className="mbk-box-model-side mbk-reset" data-side="top">
        {top}
      </span>
      <span className="mbk-box-model-side mbk-reset" data-side="left">
        {left}
      </span>
      <span className="mbk-box-model-content mbk-reset">
        {width} × {height}
      </span>
      <span className="mbk-box-model-side mbk-reset" data-side="right">
        {right}
      </span>
      <span className="mbk-box-model-side mbk-reset" data-side="bottom">
        {bottom}
      </span>
    </div>
  );
}
