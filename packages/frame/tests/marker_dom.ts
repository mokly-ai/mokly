/**
 * A parsed HTML document that offers the few DOM calls the marker readers
 * make: a comment walker in document order, ranges, and `body`.
 */

import { parse, type DefaultTreeAdapterMap } from "parse5";

type HtmlNode = DefaultTreeAdapterMap["node"];
type CommentNode = DefaultTreeAdapterMap["commentNode"];

/** A comment as the readers see it, carrying its parsed node. */
interface MarkerComment {
  data: string;
  textContent: string;
  node: CommentNode;
}

/** The boundaries that a reader set on one range. */
class RecordedRange {
  start?: CommentNode;
  end?: CommentNode;
  contents?: HtmlNode;
  setStartAfter(comment: MarkerComment) {
    this.start = comment.node;
  }
  setEndBefore(comment: MarkerComment) {
    this.end = comment.node;
  }
  selectNodeContents(node: HtmlNode) {
    this.contents = node;
  }
}

function* nodes(node: HtmlNode): Generator<HtmlNode> {
  yield node;
  if ("childNodes" in node)
    for (const child of node.childNodes) yield* nodes(child);
}

function text(node: HtmlNode): string {
  if (node.nodeName === "#text")
    return (node as DefaultTreeAdapterMap["textNode"]).value;
  return "childNodes" in node && node.nodeName !== "#comment"
    ? node.childNodes.map(text).join("")
    : "";
}

/** The text that a range covers, with runs of white space collapsed. */
export function rangeText(range: Range): string {
  const recorded = range as unknown as RecordedRange;
  let covered: HtmlNode[] = recorded.contents ? [recorded.contents] : [];
  if (recorded.start && recorded.end) {
    const siblings = recorded.start.parentNode!.childNodes;
    covered = siblings.slice(
      siblings.indexOf(recorded.start) + 1,
      siblings.indexOf(recorded.end),
    );
  }
  return covered.map(text).join("").replace(/\s+/g, " ").trim();
}

/** Parse one body into a document whose walker yields its comments in order. */
export function markerDocument(body: string): Document {
  const tree = parse(
    `<!doctype html><html><head></head><body>${body}</body></html>`,
  );
  const all = [...nodes(tree)];
  const comments: MarkerComment[] = all
    .filter((node): node is CommentNode => node.nodeName === "#comment")
    .map((node) => ({ data: node.data, textContent: node.data, node }));
  return {
    body: all.find((node) => node.nodeName === "body"),
    createRange: () => new RecordedRange(),
    createTreeWalker: () => {
      let index = 0;
      return { nextNode: () => comments[index++] ?? null };
    },
  } as unknown as Document;
}
