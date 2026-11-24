import type { DefaultTreeAdapterMap } from "parse5";
import postcss from "postcss";
import type { AtRule, ChildNode, Root, Rule } from "postcss";

import type { HtmlInput } from "./html_input.js";

/** The class tokens of every element of the fragment. */
export function classTokens(input: HtmlInput): Set<string> {
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
  visit(input.tree);
  return tokens;
}

function unescape(value: string): string {
  return value.replace(/\\([0-9a-f]{1,6}\s?|.)/gi, (_, escaped: string) =>
    /^[0-9a-f]/i.test(escaped)
      ? String.fromCodePoint(parseInt(escaped.trim(), 16) || 0xfffd)
      : escaped,
  );
}

/** The unescaped class names of one selector; a selector matches when the fragment has each. */
export function selectorClasses(selector: string): string[] {
  return [
    ...selector.matchAll(/\.((?:\\(?:[0-9a-f]{1,6}\s?|.)|[\w-])+)/gi),
  ].map((match) => unescape(match[1]!));
}

/** A keyframes, font-face, or property rule stays only when a kept declaration names it. */
export function isDependency(rule: AtRule): boolean {
  return /keyframes$|^font-face$|^property$/i.test(rule.name);
}

/** A rule inside keyframes is a keyframe step, which only its keyframes rule keeps. */
export function inKeyframes(rule: Rule): boolean {
  for (
    let parent = rule.parent;
    parent && parent.type !== "root";
    parent = parent.parent
  ) {
    if (parent.type === "atrule" && /keyframes$/i.test(parent.name))
      return true;
  }
  return false;
}

/** The name by which a declaration value refers to a dependency rule. */
export function dependencyName(rule: AtRule): string {
  let name = rule.params.replace(/^['"]|['"]$/g, "");
  if (rule.name.toLowerCase() === "font-face")
    rule.walkDecls("font-family", (decl) => {
      name = decl.value.replace(/^['"]|['"]$/g, "");
    });
  return name;
}

/** The words of a declaration value; a dependency is named by one of them. */
export function valueWords(value: string): string[] {
  return value.split(/[\s,()'"/]+/);
}

/** A custom property is also named by a `var(` prefix of its name. */
export function namesVariable(value: string, name: string): boolean {
  return value.includes(`var(${name}`);
}

/** Remove every node outside `needed` in document order, then print the root. */
export function pruned(root: Root, needed: ReadonlySet<ChildNode>): string {
  function keep(node: ChildNode): boolean {
    if (needed.has(node)) return true;
    if (node.type === "atrule" && !isDependency(node) && node.nodes) {
      for (const child of [...node.nodes]) if (!keep(child)) child.remove();
      return node.nodes.length > 0;
    }
    return false;
  }
  for (const node of [...root.nodes]) if (!keep(node)) node.remove();
  return root.toString();
}

/** Filter persistent registries by fragment classes, then close rule dependencies. */
export function registryStyles(css: string, input: HtmlInput): string {
  if (!css) return "";
  const tokens = classTokens(input);
  const root = postcss.parse(css);
  const needed = new Set<ChildNode>();
  const declarations: string[] = [];
  const dependencies: AtRule[] = [];
  root.walkAtRules((rule) => {
    if (isDependency(rule)) dependencies.push(rule);
  });
  root.walkRules((rule) => {
    if (inKeyframes(rule)) return;
    const matches = rule.selectors.some((selector) =>
      selectorClasses(selector).every((name) => tokens.has(name)),
    );
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
      const name = dependencyName(rule);
      if (
        name &&
        declarations.some(
          (value) =>
            valueWords(value).includes(name) || namesVariable(value, name),
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
  return pruned(root, needed);
}
