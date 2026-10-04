import type { DefaultTreeAdapterMap } from "parse5";

import type { ComponentViewRecord } from "@mokly/viewer";

import type { RenderedRange } from "../../components/ranges.js";

import type { CssOutputRange } from "./containment.js";
import type { CssDocument, CssNode } from "./document.js";

/** Rebase validated boundaries, including root comments removed by paired ignore. */
export function normalizedOutputRanges(
  document: CssDocument,
  original: string,
  ranges: readonly RenderedRange[],
  usage: ComponentViewRecord | undefined,
  root?: string,
): CssOutputRange[] {
  const comments = new Map<
    string,
    NonNullable<DefaultTreeAdapterMap["commentNode"]["sourceCodeLocation"]>
  >();
  const visit = (node: CssNode): void => {
    if (
      node.nodeName === "#comment" &&
      "data" in node &&
      node.sourceCodeLocation
    )
      comments.set(node.data, node.sourceCodeLocation);
    if ("childNodes" in node) node.childNodes.forEach(visit);
    if ("content" in node) visit(node.content);
  };
  visit(document);
  const ignored = (offset: number, start: boolean) => {
    let open: { id: string; start: number } | undefined;
    for (const marker of original.matchAll(
      /<!--mokly-review-ignore:(start|end):([a-z0-9-]+)-->/g,
    )) {
      if (marker[1] === "start")
        open = { id: marker[2]!, start: marker.index! };
      else if (open) {
        if (open.start <= offset && offset < marker.index!) {
          const replacement = comments.get(`mokly-review-ignore:${open.id}`);
          return start ? replacement?.endOffset : replacement?.startOffset;
        }
        open = undefined;
      }
    }
    return undefined;
  };
  return ranges.flatMap((range) => {
    const target = range.record.target;
    const componentId =
      target.kind === "root"
        ? root
        : target.kind === "instance"
          ? usage?.instances.find(
              (instance) => instance.key === target.instanceKey,
            )?.componentId
          : undefined;
    if (!componentId) return [];
    const start =
      comments.get(`mokly-component:start:${range.record.id}`)?.endOffset ??
      (target.kind === "root" ? ignored(range.start, true) : undefined);
    const end =
      comments.get(`mokly-component:end:${range.record.id}`)?.startOffset ??
      (target.kind === "root" ? ignored(range.contentEnd, false) : undefined);
    return start === undefined || end === undefined || end < start
      ? []
      : [
          {
            rangeId: range.record.id,
            componentId,
            root: target.kind === "root",
            start,
            end,
          },
        ];
  });
}
