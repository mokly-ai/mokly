/** Adapt parse5 documents for selector matching with HTML and foreign-name semantics. */
import type { Options } from "css-select";
import { defaultTreeAdapter, html } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

/** The same default parse5 document produced by HTML reference discovery. */
export type CssDocument = DefaultTreeAdapterMap["document"];
/** Default-tree nodes accepted by the selector adapter. */
export type CssNode = DefaultTreeAdapterMap["node"];
/** Default-tree elements accepted by compiled selector predicates. */
export type CssElement = DefaultTreeAdapterMap["element"];

/** Paired, already-normalized view documents; absent sides are not invented. */
export interface CssDocumentPair {
  before?: CssDocument;
  after?: CssDocument;
}

const adapter: NonNullable<Options<CssNode, CssElement>["adapter"]> = {
  isTag: defaultTreeAdapter.isElementNode,
  getChildren: children,
  getParent: parent,
  getSiblings: (node) => {
    const ancestor = parent(node);
    return ancestor ? children(ancestor) : [node];
  },
  getName: (element) => element.tagName,
  getAttributeValue: attribute,
  hasAttrib: (element, name) => attribute(element, name) !== undefined,
  getText: text,
  removeSubsets(nodes) {
    const unique = new Set(nodes);
    return [...unique].filter((node) => {
      for (let ancestor = parent(node); ancestor; ancestor = parent(ancestor))
        if (unique.has(ancestor)) return false;
      return true;
    });
  },
};

/** Query options for a read-only default-adapter tree, including its document mode. */
export function cssDocumentOptions(
  document?: CssDocument,
): Options<CssNode, CssElement> {
  return {
    adapter,
    relativeSelector: false,
    quirksMode: document?.mode === "quirks",
  };
}

function children(node: CssNode): CssNode[] {
  return "childNodes" in node ? node.childNodes : [];
}

function parent(node: CssNode): CssNode | null {
  return "parentNode" in node ? node.parentNode : null;
}

function attribute(element: CssElement, name: string): string | undefined {
  const normalize = (value: string): string =>
    element.namespaceURI === html.NS.HTML ? value.toLowerCase() : value;
  return element.attrs.find(
    (item) =>
      normalize(item.prefix ? `${item.prefix}:${item.name}` : item.name) ===
      normalize(name),
  )?.value;
}

function text(node: CssNode): string {
  const values: string[] = [];
  const pending = [node];
  while (pending.length) {
    const current = pending.pop()!;
    if (defaultTreeAdapter.isTextNode(current)) values.push(current.value);
    else pending.push(...[...children(current)].reverse());
  }
  return values.join("");
}
