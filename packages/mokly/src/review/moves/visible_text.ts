import { parse, type DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["node"];
const blocks = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tr",
  "ul",
]);
const omitted = new Set(["script", "style", "template", "noscript", "head"]);

/** Body text split at block elements; hidden subtrees and generated head are absent. */
export function visiblePageText(html: string): string {
  const pieces: string[] = [];
  const visit = (node: Node, inBody = false, preformatted = false): void => {
    if ("tagName" in node) {
      if (
        omitted.has(node.tagName) ||
        node.attrs.some(
          (attr) =>
            attr.name === "hidden" ||
            (attr.name === "aria-hidden" &&
              attr.value.toLowerCase() === "true"),
        )
      )
        return;
      inBody ||= node.tagName === "body";
      preformatted ||= node.tagName === "pre";
      if (inBody && (blocks.has(node.tagName) || node.tagName === "br"))
        pieces.push("\n");
      if (inBody && ["td", "th"].includes(node.tagName)) pieces.push(" ");
    }
    if ("value" in node && inBody)
      pieces.push(preformatted ? node.value : node.value.replace(/\s+/gu, " "));
    if ("childNodes" in node)
      for (const child of node.childNodes) visit(child, inBody, preformatted);
    if ("tagName" in node && inBody && blocks.has(node.tagName))
      pieces.push("\n");
  };
  visit(parse(html));
  return pieces
    .join("")
    .split("\n")
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter(Boolean)
    .join("\n");
}
