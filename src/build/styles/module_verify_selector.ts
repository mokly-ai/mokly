import { createRequire } from "node:module";

interface SelectorNode {
  readonly type: string;
  readonly value?: string;
  readonly nodes?: readonly SelectorNode[];
  readonly attribute?: string;
  readonly operator?: string;
  readonly insensitive?: boolean;
  readonly namespace?: string;
  readonly quoteMark?: string;
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
    const original = normalize(parser().astSync(input), true);
    const changed = normalize(parser().astSync(output), false);
    return sameShapes(original, changed, prefix);
  } catch {
    return false;
  }
}

function normalize(node: SelectorNode, input: boolean): SelectorShape {
  return {
    type: node.type,
    value:
      node.type === "combinator" && !node.value?.trim()
        ? " "
        : node.type === "combinator"
          ? (node.value ?? "").trim()
          : (node.value ?? ""),
    children: normalizeChildren(node.nodes ?? [], input),
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
  input: boolean,
): SelectorShape[] {
  const normalized: SelectorShape[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (
      input &&
      node.type === "pseudo" &&
      [":global", ":local"].includes(node.value ?? "")
    ) {
      if (node.nodes?.length) {
        if (node.nodes.some((selector) => selector.type !== "selector"))
          return [{ type: "invalid", value: "", children: [] }];
        for (const [selectorIndex, selector] of node.nodes.entries()) {
          if (selectorIndex > 0)
            normalized.push({ type: "combinator", value: " ", children: [] });
          normalized.push(...normalizeChildren(selector.nodes ?? [], true));
        }
      } else if (nodes[index + 1]?.type === "combinator") index += 1;
      continue;
    }
    normalized.push(normalize(node, input));
  }
  return normalized;
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
