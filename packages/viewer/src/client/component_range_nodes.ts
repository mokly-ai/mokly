/** Enumerate owned element and text boxes with their actual clipping ancestors. */
export function* componentNodeRects(
  range: Range,
): Generator<{ rect: DOMRect; node: Node }> {
  const doc = range.startContainer.ownerDocument!;
  const win = doc.defaultView!;
  const walker = doc.createTreeWalker(range.commonAncestorContainer, 5);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!range.intersectsNode(node) || range.comparePoint(node, 0) !== 0)
      continue;
    const element =
      node.nodeType === 1 ? (node as Element) : node.parentElement;
    let visible = true;
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      const style = win.getComputedStyle(ancestor);
      if (
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        style.opacity === "0"
      ) {
        visible = false;
        break;
      }
    }
    if (!visible) continue;
    if (node.nodeType === 1) {
      for (const rect of (node as Element).getClientRects())
        yield { rect, node };
    } else {
      const text = doc.createRange();
      text.selectNodeContents(node);
      for (const rect of text.getClientRects()) yield { rect, node };
    }
  }
}
