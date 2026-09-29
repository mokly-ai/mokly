import { createRequire } from "node:module";

import {
  cssWhitespaceAt,
  cssWhitespaceOnly,
  scanCssText,
  trimCssWhitespace,
  type CssScan,
} from "./module_css_scan.js";
import {
  authoredCommaSpace,
  wrapperMovedSpace,
} from "./module_selector_source.js";

interface SelectorNode {
  readonly type: string;
  readonly value?: string;
  readonly nodes?: readonly SelectorNode[];
  readonly attribute?: string;
  readonly operator?: string;
  readonly insensitive?: boolean;
  readonly namespace?: string;
  readonly quoteMark?: string;
  readonly sourceIndex?: number;
}

interface SelectorShape {
  readonly type: string;
  readonly value: string;
  readonly children: readonly SelectorShape[];
  readonly attribute?: string;
  readonly operator?: string;
  readonly insensitive?: boolean;
  readonly namespace?: string;
  readonly quoteMark?: string;
}

type SelectorParser = () => {
  astSync(text: string): SelectorNode;
};

const requireSelectorParser = createRequire(import.meta.url);
let parser: SelectorParser | undefined;

/** Compare selectors after input-only local/global unwrapping and spacing normalization. */
export function moduleSelectorsMatch(
  input: string,
  output: string,
  prefix: string,
): boolean {
  if (input === output) return true;
  try {
    parser ??= requireSelectorParser(
      "postcss-selector-parser",
    ) as SelectorParser;
    const original = normalize(
      parser().astSync(input),
      scanCssText(input),
      true,
    );
    const changed = normalize(
      parser().astSync(output),
      scanCssText(output),
      false,
    );
    return sameShapes(original, changed, prefix);
  } catch {
    return false;
  }
}

function normalize(
  node: SelectorNode,
  scan: CssScan,
  input: boolean,
): SelectorShape {
  return {
    type: node.type,
    value:
      node.type === "combinator" && cssWhitespaceOnly(node.value ?? "")
        ? " "
        : node.type === "combinator"
          ? trimCssWhitespace(node.value ?? "")
          : (node.value ?? ""),
    children: normalizeChildren(node.nodes ?? [], scan, input),
    ...(node.attribute ? { attribute: node.attribute } : {}),
    ...(node.operator ? { operator: node.operator } : {}),
    ...(node.insensitive ? { insensitive: node.insensitive } : {}),
    ...(node.namespace ? { namespace: node.namespace } : {}),
    ...(node.type === "attribute" &&
    node.attribute !== "class" &&
    node.quoteMark
      ? { quoteMark: node.quoteMark }
      : {}),
  };
}

function normalizeChildren(
  nodes: readonly SelectorNode[],
  scan: CssScan,
  input: boolean,
): SelectorShape[] {
  const normalized: SelectorShape[] = [];
  let movedWrapperSpace = false;
  let afterWrapper = false;
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (node.type === "comment") continue;
    if (
      input &&
      node.type === "pseudo" &&
      [":global", ":local"].includes(node.value ?? "")
    ) {
      if (
        scan.text[(node.sourceIndex ?? -1) + (node.value?.length ?? 0)] !== "("
      ) {
        if (nodes[index + 1]?.type === "combinator") index += 1;
        movedWrapperSpace = false;
        afterWrapper = false;
        continue;
      }
      if (node.nodes?.length) {
        if (node.nodes.some((selector) => selector.type !== "selector"))
          return [{ type: "invalid", value: "", children: [] }];
        let previous: SelectorNode | undefined;
        let accepted = false;
        for (const selector of node.nodes) {
          const children = normalizeChildren(selector.nodes ?? [], scan, true);
          if (!children.length) continue;
          const separate = accepted
            ? previous !== undefined &&
              authoredCommaSpace(scan, previous, selector)
            : movedWrapperSpace ||
              cssWhitespaceAt(scan, (node.sourceIndex ?? 0) - 1);
          appendChildren(normalized, children, separate, true);
          accepted = true;
          previous = selector;
        }
        if (!accepted) return [{ type: "invalid", value: "", children: [] }];
        afterWrapper = true;
      } else return [{ type: "invalid", value: "", children: [] }];
      movedWrapperSpace = wrapperMovedSpace(scan, node);
      continue;
    }
    const child = normalize(node, scan, input);
    if (child.type === "combinator") {
      normalized.push(child);
      movedWrapperSpace = false;
      afterWrapper = false;
      continue;
    }
    appendChildren(
      normalized,
      [child],
      movedWrapperSpace || cssWhitespaceAt(scan, (node.sourceIndex ?? 0) - 1),
      afterWrapper,
    );
    movedWrapperSpace = input && wrapperMovedSpace(scan, node);
    afterWrapper = false;
  }
  return normalized;
}

function appendChildren(
  target: SelectorShape[],
  children: readonly SelectorShape[],
  separate: boolean,
  introduced: boolean,
): void {
  const previous = target.at(-1);
  const first = children[0];
  if (
    previous &&
    first &&
    previous.type !== "combinator" &&
    first.type !== "combinator"
  ) {
    if (separate) target.push({ type: "combinator", value: " ", children: [] });
    else if (introduced && ["tag", "universal"].includes(first.type))
      target.push({ type: "invalid", value: "", children: [] });
  }
  target.push(...children);
}

function sameShapes(
  input: SelectorShape,
  output: SelectorShape,
  prefix: string,
): boolean {
  if (input.type !== output.type) return false;
  if (input.children.length !== output.children.length) return false;
  if (
    input.attribute !== output.attribute ||
    input.operator !== output.operator ||
    input.insensitive !== output.insensitive ||
    input.namespace !== output.namespace ||
    input.quoteMark !== output.quoteMark
  )
    return false;
  const eligible =
    input.type === "class" ||
    input.type === "id" ||
    (input.type === "attribute" &&
      input.attribute === "class" &&
      input.operator === "=");
  if (
    !(eligible
      ? output.value === input.value ||
        output.value === `${prefix}${input.value}`
      : input.value === output.value)
  )
    return false;
  return input.children.every((child, index) =>
    sameShapes(child, output.children[index]!, prefix),
  );
}
