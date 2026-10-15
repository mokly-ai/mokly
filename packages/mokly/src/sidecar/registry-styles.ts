import { parseFragment } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import postcss from "postcss";
import type { AtRule, ChildNode } from "postcss";

function classes(html: string): Set<string> {
  const tokens = new Set<string>();
  function visit(node: DefaultTreeAdapterMap["node"]) {
    if ("attrs" in node) {
      const value = node.attrs.find(
        (attribute) => attribute.name === "class",
      )?.value;
      for (const token of value?.split(/\s+/) ?? [])
        if (token) tokens.add(token);
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
  }
  visit(parseFragment(html));
  return tokens;
}

function unescape(value: string): string {
  return value.replace(/\\([0-9a-f]{1,6}\s?|.)/gi, (_, escaped: string) =>
    /^[0-9a-f]/i.test(escaped)
      ? String.fromCodePoint(parseInt(escaped.trim(), 16) || 0xfffd)
      : escaped,
  );
}

/** Filter persistent registries by fragment classes, then close rule dependencies. */
export function registryStyles(css: string, html: string): string {
  if (!css) return "";
  const tokens = classes(html);
  const root = postcss.parse(css);
  const needed = new Set<ChildNode>();
  const declarations: string[] = [];
  const dependencies: AtRule[] = [];
  root.walkAtRules((rule) => {
    if (/keyframes$|^font-face$|^property$/i.test(rule.name))
      dependencies.push(rule);
  });
  root.walkRules((rule) => {
    for (
      let parent = rule.parent;
      parent && parent.type !== "root";
      parent = parent.parent
    ) {
      if (parent.type === "atrule" && /keyframes$/i.test(parent.name)) return;
    }
    const matches = rule.selectors.some((selector) => {
      const names = [
        ...selector.matchAll(/\.((?:\\(?:[0-9a-f]{1,6}\s?|.)|[\w-])+)/gi),
      ].map((match) => unescape(match[1]!));
      return names.every((name) => tokens.has(name));
    });
    if (matches) {
      needed.add(rule);
      rule.walkDecls((declaration) => {
        declarations.push(declaration.value);
      });
    }
  });
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of dependencies) {
      if (needed.has(rule)) continue;
      let name = rule.params.replace(/^['"]|['"]$/g, "");
      if (rule.name.toLowerCase() === "font-face")
        rule.walkDecls("font-family", (decl) => {
          name = decl.value.replace(/^['"]|['"]$/g, "");
        });
      if (
        name &&
        declarations.some(
          (value) =>
            value.split(/[\s,()'"/]+/).includes(name) ||
            value.includes(`var(${name}`),
        )
      ) {
        needed.add(rule);
        rule.walkDecls((declaration) => {
          declarations.push(declaration.value);
        });
        changed = true;
      }
    }
  }
  function prune(node: ChildNode): boolean {
    if (needed.has(node)) return true;
    if (node.type === "atrule" && !dependencies.includes(node) && node.nodes) {
      for (const child of [...node.nodes]) if (!prune(child)) child.remove();
      return node.nodes.length > 0;
    }
    return false;
  }
  for (const node of [...root.nodes]) if (!prune(node)) node.remove();
  return root.toString();
}
