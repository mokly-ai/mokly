import { type DefaultTreeAdapterMap, parse } from "parse5";

import { walkTree } from "../../scripts/script-elements.js";

type Element = DefaultTreeAdapterMap["element"];

export function documentStyles(html: string) {
  const head: Element[] = [];
  const links: string[] = [];
  const styles: Element[] = [];
  walkTree(parse(html), (node) => {
    if (!("tagName" in node)) return;
    if (node.tagName === "style") {
      styles.push(node);
    } else if (node.tagName === "link") {
      const rel = node.attrs.find(({ name }) => name === "rel")?.value ?? "";
      const tokens = rel.toLowerCase().split(/[\t\n\f\r ]+/);
      if (!tokens.includes("stylesheet")) return;
      links.push(node.attrs.find(({ name }) => name === "href")?.value ?? "");
    } else {
      return;
    }
    const parent = node.parentNode;
    if (parent && "tagName" in parent && parent.tagName === "head") {
      head.push(node);
    }
  });
  return { head, links, styles };
}
