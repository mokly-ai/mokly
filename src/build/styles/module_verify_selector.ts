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
  readonly spaces?: { readonly before?: string; readonly after?: string };
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
  let pendingWhitespace = false;
  let afterWrapper = false;
  let removedEmptyWrapper = false;
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (node.type === "comment") {
      pendingWhitespace ||=
        hasWhitespace(node.spaces?.before) || hasWhitespace(node.spaces?.after);
      continue;
    }
    if (
      input &&
      node.type === "pseudo" &&
      [":global", ":local"].includes(node.value ?? "")
    ) {
      if (node.nodes?.length) {
        if (node.nodes.some((selector) => selector.type !== "selector"))
          return [{ type: "invalid", value: "", children: [] }];
        let previous: SelectorNode | undefined;
        let betweenWhitespace = false;
        let accepted = false;
        for (const selector of node.nodes) {
          const children = normalizeChildren(selector.nodes ?? [], true);
          const first = firstNode(selector);
          const last = lastNode(selector);
          const leading = hasWhitespace(first?.spaces?.before);
          const trailing = hasWhitespace(last?.spaces?.after);
          if (!children.length) {
            betweenWhitespace ||= leading || trailing;
            continue;
          }
          const separate = accepted
            ? betweenWhitespace ||
              hasWhitespace(previous?.spaces?.after) ||
              leading
            : pendingWhitespace;
          appendChildren(normalized, children, separate, true);
          accepted = true;
          previous = last;
          betweenWhitespace = trailing;
        }
        if (!accepted) {
          removedEmptyWrapper = true;
          pendingWhitespace = false;
          afterWrapper = false;
          continue;
        }
        pendingWhitespace = false;
        afterWrapper = true;
        removedEmptyWrapper = false;
      } else {
        if (nodes[index + 1]?.type === "combinator") index += 1;
        pendingWhitespace = false;
        afterWrapper = false;
      }
      continue;
    }
    const child = normalize(node, input);
    if (child.type === "combinator") {
      if (removedEmptyWrapper && !normalized.length) {
        removedEmptyWrapper = false;
        continue;
      }
      if (normalized.at(-1)?.type !== "combinator") normalized.push(child);
      pendingWhitespace = false;
      afterWrapper = false;
      removedEmptyWrapper = false;
      continue;
    }
    appendChildren(
      normalized,
      [child],
      pendingWhitespace || hasWhitespace(node.spaces?.before),
      afterWrapper,
    );
    pendingWhitespace = hasWhitespace(node.spaces?.after);
    afterWrapper = false;
    removedEmptyWrapper = false;
  }
  if (removedEmptyWrapper && normalized.at(-1)?.type === "combinator")
    normalized.pop();
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

function firstNode(selector: SelectorNode): SelectorNode | undefined {
  return selector.nodes?.[0];
}

function lastNode(selector: SelectorNode): SelectorNode | undefined {
  return selector.nodes?.at(-1);
}

function hasWhitespace(value: string | undefined): boolean {
  return value !== undefined && /\s/u.test(value);
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
