import { type DefaultTreeAdapterMap, parse } from "parse5";

import { walkTree } from "../../scripts/script-elements.js";

export function documentStyles(html: string) {
  const links: string[] = [];
  const styles: DefaultTreeAdapterMap["element"][] = [];
  walkTree(parse(html), (node) => {
    if (!("tagName" in node)) return;
    if (node.tagName === "style") styles.push(node);
    if (node.tagName !== "link") return;
    const rel = node.attrs.find(({ name }) => name === "rel")?.value ?? "";
    const tokens = rel.toLowerCase().split(/[\t\n\f\r ]+/);
    if (tokens.includes("stylesheet")) {
      links.push(node.attrs.find(({ name }) => name === "href")?.value ?? "");
    }
  });
  return { links, styles };
}
