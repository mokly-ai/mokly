import type { Box } from "../frame_adapter.js";

/** Viewport rectangles use edge tuples to share clipping across both measurers. */
export type Edges = [left: number, top: number, right: number, bottom: number];
export const edges = (rect: DOMRect): Edges => [
  rect.left,
  rect.top,
  rect.right,
  rect.bottom,
];
export const viewport = (doc: Document): Edges => [
  0,
  0,
  doc.defaultView!.innerWidth,
  doc.defaultView!.innerHeight,
];

export const boundedPixel = (value: number, minimum = 0): number => {
  if (!(value >= minimum && value <= 1000000)) throw "limit";
  return value;
};

export const boundedBox = (
  x: number,
  y: number,
  width: number,
  height: number,
): Box => ({
  x: boundedPixel(x, -1000000),
  y: boundedPixel(y, -1000000),
  width: boundedPixel(width),
  height: boundedPixel(height),
});

export const combineEdges = (a: Edges, b: Edges, union = false): Edges =>
  a.map((value, axis) =>
    (axis < 2 === union ? Math.min : Math.max)(value, b[axis]!),
  ) as Edges;

/** Fixed descendants escape overflow until their actual containing block. */
const fixedContainer = (style: CSSStyleDeclaration): boolean =>
  containingBlockStyles.some(
    (property) =>
      (!!style[property] && style[property] !== "none") ||
      style.willChange?.includes(property),
  ) ||
  (!!style.backdropFilter && style.backdropFilter !== "none") ||
  /(paint|layout|strict|content)/.test(style.contain) ||
  style.contentVisibility === "auto";
const containingBlockStyles = [
  "transform",
  "translate",
  "rotate",
  "scale",
  "perspective",
  "filter",
] as const;

/** Clip the measured node, retaining ancestor visibility even across fixed escapes. */
export function clipNode(node: Node, bounds: Edges): Edges {
  const win = node.ownerDocument!.defaultView!;
  const clip: Edges = [...bounds];
  let fixed = false;
  for (
    let parent = node.nodeType === 1 ? (node as Element) : node.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const style = win.getComputedStyle(parent);
    if (style.visibility !== "visible" || style.opacity === "0") {
      clip[2] = clip[0];
      break;
    }
    if (parent !== node && (!fixed || fixedContainer(style))) {
      fixed = false;
      const rect = edges(parent.getBoundingClientRect());
      for (const axis of [0, 1])
        if (
          /(hidden|clip|scroll|auto)/.test(
            axis ? style.overflowY : style.overflowX,
          ) ||
          /(paint|strict|content)/.test(style.contain)
        ) {
          clip[axis] = Math.max(clip[axis]!, rect[axis]!);
          clip[axis + 2] = Math.min(clip[axis + 2]!, rect[axis + 2]!);
        }
    }
    if (style.position === "fixed") fixed = true;
  }
  return clip;
}
