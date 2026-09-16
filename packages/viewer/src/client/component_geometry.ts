/** Read-only DOM range authentication and clipped geometry in immediate frames. */
import type { ComponentViewRecord } from "../components/manifest_types.js";
import { clipNode } from "../inspector/clipping.js";

import { uncoveredBoxes } from "./component_occlusion.js";
import { componentNodeRects } from "./component_range_nodes.js";
import {
  authenticateDocumentRanges,
  type AuthenticatedRanges,
} from "./document_ranges.js";
import { localFrameAccess } from "./same_origin_access.js";

export interface ComponentBounds {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export function authenticateRanges(
  frame: HTMLIFrameElement,
  path: string,
  usage: ComponentViewRecord,
): AuthenticatedRanges | undefined {
  try {
    const doc = localFrameAccess(frame).document();
    const parent = frame.ownerDocument;
    const location = doc?.defaultView?.location;
    if (
      !doc ||
      !location ||
      doc.defaultView?.frameElement !== frame ||
      frame.sandbox.value !== "allow-same-origin" ||
      location.origin !== parent.defaultView?.location.origin
    )
      return;
    const actual = decodeURIComponent(location.pathname).replace(/\.html$/, "");
    const expected = path.startsWith("/__mokly/components/renders/")
      ? path
      : `/static/${path}`;
    if (actual !== expected.replace(/\.html$/, "")) return;
    return authenticateDocumentRanges(
      doc,
      usage.ranges.map((range) => ({
        id: range.id,
        ...(range.parentId ? { parentId: range.parentId } : {}),
        ...(range.target.kind === "instance"
          ? { key: range.target.instanceKey }
          : {}),
      })),
    );
  } catch {
    return;
  }
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
function intersect(a: Box, b: Box): Box | undefined {
  const box = {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
  return box.right > box.left && box.bottom > box.top ? box : undefined;
}
function clipAncestors(box: Box, node: Node): Box | undefined {
  const [left, top, right, bottom] = clipNode(node, [
    box.left,
    box.top,
    box.right,
    box.bottom,
  ]);
  return intersect(box, { left, top, right, bottom });
}
/** Read each actual range without inserting wrappers or changing consumer styles. */
export function rangeBounds(
  frame: Pick<HTMLIFrameElement, "clientWidth" | "clientHeight">,
  authenticated: AuthenticatedRanges,
  keys: ReadonlySet<string>,
  overlay?: Element,
): ComponentBounds[] {
  const { doc, ranges } = authenticated;
  const result: ComponentBounds[] = [];
  const candidates = [...doc.querySelectorAll("body *")].filter(
    (node) => !overlay?.contains(node),
  );
  const rects = new WeakMap<Element, readonly DOMRect[]>();
  for (const [key, values] of ranges) {
    if (!keys.has(key)) continue;
    for (const range of values) {
      for (const { rect, node } of componentNodeRects(range)) {
        let box = intersect(rect, {
          left: 0,
          top: 0,
          right: frame.clientWidth,
          bottom: frame.clientHeight,
        });
        if (!box) continue;
        box = clipAncestors(box, node);
        if (!box) continue;
        for (const visible of uncoveredBoxes(box, range, candidates, rects))
          result.push({
            key,
            x: visible.left,
            y: visible.top,
            width: visible.right - visible.left,
            height: visible.bottom - visible.top,
          });
      }
    }
  }
  return result.filter(
    (box, index) =>
      !result.some(
        (other, otherIndex) =>
          other.key === box.key &&
          otherIndex !== index &&
          other.x <= box.x &&
          other.y <= box.y &&
          other.x + other.width >= box.x + box.width &&
          other.y + other.height >= box.y + box.height &&
          (other.width > box.width ||
            other.height > box.height ||
            otherIndex < index),
      ),
  );
}
export function visibleFrameBox(frame: HTMLIFrameElement): Box | undefined {
  const win = frame.ownerDocument.defaultView!;
  const bounds = frame.getBoundingClientRect();
  const viewport = intersect(bounds, {
    left: 0,
    top: 0,
    right: win.innerWidth,
    bottom: win.innerHeight,
  });
  return viewport ? clipAncestors(viewport, frame) : undefined;
}
