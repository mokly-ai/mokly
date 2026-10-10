import { html, parse, type DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

/** An active link and its decoded attributes in the parsed document. */
export interface HtmlLink {
  element: Element;
  attributes: ReadonlyMap<string, string>;
  location: NonNullable<Element["sourceCodeLocation"]>;
  scope: "head" | "body";
  stylesheet: boolean;
  resourceHint: boolean;
}

/** HTML rel tokens use ASCII whitespace and ASCII case folding. */
function linkRelTokens(element: Element): readonly string[] {
  return (element.attrs.find(({ name }) => name === "rel")?.value ?? "")
    .replace(/[A-Z]/g, (letter) => letter.toLowerCase())
    .split(/[\t\n\f\r ]+/);
}

/** Find active HTML links, excluding foreign elements, template and noscript text. */
export function parseHtmlLinks(content: string): {
  document: DefaultTreeAdapterMap["document"];
  head?: Element;
  links: readonly HtmlLink[];
} {
  const document = parse(content, {
    sourceCodeLocationInfo: true,
    scriptingEnabled: true,
  });
  const links: HtmlLink[] = [];
  let head: Element | undefined;
  function visit(node: Node, scope: "head" | "body"): void {
    if ("tagName" in node) {
      if (node.tagName === "head") {
        head = node;
        scope = "head";
      } else if (node.tagName === "body") scope = "body";
      if (
        node.tagName === "link" &&
        node.namespaceURI === html.NS.HTML &&
        node.sourceCodeLocation
      ) {
        const rel = linkRelTokens(node);
        const stylesheet = rel.includes("stylesheet");
        links.push({
          element: node,
          attributes: new Map(
            node.attrs.map(({ name, value }) => [name, value]),
          ),
          location: node.sourceCodeLocation,
          scope,
          stylesheet,
          resourceHint:
            !stylesheet &&
            rel.some((token) =>
              [
                "preload",
                "modulepreload",
                "prefetch",
                "preconnect",
                "dns-prefetch",
              ].includes(token),
            ),
        });
      }
    }
    if ("childNodes" in node)
      for (const child of node.childNodes) visit(child, scope);
  }
  visit(document, "body");
  return { document, ...(head ? { head } : {}), links };
}
