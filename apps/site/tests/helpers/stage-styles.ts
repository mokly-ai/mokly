import { transform } from "lightningcss";
import { type DefaultTreeAdapterMap, parse } from "parse5";

import { walkTree } from "../../scripts/script-elements.js";
import { local, safeTarget } from "../../scripts/stage/stylesheets.js";

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

export function analyzeStylesheet(css: string, file: string) {
  const result = transform({
    filename: file,
    code: Buffer.from(css),
    analyzeDependencies: true,
  });
  let code = Buffer.from(result.code).toString("utf8");
  const dependencies = [];
  for (const [index, dependency] of (result.dependencies ?? []).entries()) {
    if (dependency.type !== "import" && dependency.type !== "url") continue;
    const { type, url, placeholder } = dependency;
    const hash = url.indexOf("#");
    const fragment = hash < 0 ? "" : url.slice(hash);
    dependencies.push({
      type,
      url: local(url) ? safeTarget(file, url) + fragment : url,
    });
    // Repeated URLs can share a placeholder. Replace one occurrence per dependency.
    code = code.replace(`"${placeholder}"`, `"dependency-${index}"`);
  }
  return { code, dependencies };
}
