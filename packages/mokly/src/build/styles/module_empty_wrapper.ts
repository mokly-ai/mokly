import { createRequire } from "node:module";

import type { Root } from "postcss";

import { MoklyError } from "../../errors.js";

interface SelectorNode {
  readonly type: string;
  readonly value?: string;
  readonly sourceIndex?: number;
  readonly nodes?: readonly SelectorNode[];
}

type SelectorParser = () => { astSync(text: string): SelectorNode };

const requireSelectorParser = createRequire(import.meta.url);
let parser: SelectorParser | undefined;

/** Reject global/local wrappers with no selector before plugins can erase them. */
export function rejectEmptyModuleWrappers(root: Root, relative: string): void {
  root.walkRules((rule) => {
    let selector: SelectorNode;
    try {
      parser ??= requireSelectorParser(
        "postcss-selector-parser",
      ) as SelectorParser;
      selector = parser().astSync(rule.selector);
    } catch {
      return;
    }
    const empty = findEmptyWrapper(selector, rule.selector);
    if (!empty) return;
    const start = rule.source?.start;
    throw new MoklyError(
      "build-invalid",
      `CSS Modules ${empty} has no selector in ${relative}:${start?.line ?? 1}:${start?.column ?? 1}; add a selector inside it or remove it`,
    );
  });
}

function findEmptyWrapper(
  node: SelectorNode,
  selector: string,
): ":global()" | ":local()" | undefined {
  if (
    node.type === "pseudo" &&
    (node.value === ":global" || node.value === ":local") &&
    selector[(node.sourceIndex ?? -1) + node.value.length] === "(" &&
    node.nodes?.every(
      (selector) => !selector.nodes?.some((child) => child.type !== "comment"),
    )
  )
    return `${node.value}()`;
  for (const child of node.nodes ?? []) {
    const found = findEmptyWrapper(child, selector);
    if (found) return found;
  }
  return;
}
