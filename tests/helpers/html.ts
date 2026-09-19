import { parse, type DefaultTreeAdapterMap } from "parse5";

type HtmlNode = DefaultTreeAdapterMap["node"];
export type HtmlElement = DefaultTreeAdapterMap["element"];

export function documentText(content: string): string {
  return textContent(parse(content));
}

/** Find document elements without matching serialized JSON script contents. */
export function documentElements(
  content: string,
  predicate: (element: HtmlElement) => boolean,
): HtmlElement[] {
  return elements(parse(content), predicate);
}

/** Find matching elements in one parsed document subtree. */
export function elements(
  node: HtmlNode,
  predicate: (element: HtmlElement) => boolean,
): HtmlElement[] {
  const matches = "tagName" in node && predicate(node) ? [node] : [];
  return "childNodes" in node
    ? [
        ...matches,
        ...node.childNodes.flatMap((child) => elements(child, predicate)),
      ]
    : matches;
}

/** Read one parsed element attribute. */
export function attribute(
  element: HtmlElement,
  name: string,
): string | undefined {
  return element.attrs.find((candidate) => candidate.name === name)?.value;
}

/** Read descendant text without React's SSR separator comments. */
export function textContent(node: HtmlNode): string {
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(textContent).join("") : "";
}
