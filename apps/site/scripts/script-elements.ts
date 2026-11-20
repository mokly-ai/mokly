import type { DefaultTreeAdapterMap } from "parse5";

type Attributes = DefaultTreeAdapterMap["element"]["attrs"];
type Node = DefaultTreeAdapterMap["node"];

/** Visit every parsed node breadth-first, including template content. */
export function walkTree(root: Node, visit: (node: Node) => void): void {
  const nodes = [root];
  for (const node of nodes) {
    visit(node);
    if ("childNodes" in node) nodes.push(...node.childNodes);
    if ("content" in node) nodes.push(node.content);
  }
}

/** Whether a script element's MIME type is executable in the browser. */
export function isExecutable(attrs: Attributes): boolean {
  const type = attrs.find(({ name }) => name === "type")?.value.toLowerCase();
  return (
    type === undefined ||
    type === "module" ||
    type.includes("javascript") ||
    type.includes("ecmascript")
  );
}
