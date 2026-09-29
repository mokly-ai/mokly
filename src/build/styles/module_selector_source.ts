/** Selector-parser positions refer to the authored selector, not its printed form. */
export interface SelectorSourceNode {
  readonly type: string;
  readonly value?: string;
  readonly sourceIndex?: number;
  readonly nodes?: readonly SelectorSourceNode[];
}

/** A space before a node counts only if it exists at that authored offset. */
export function authoredSpaceBefore(
  text: string,
  node: SelectorSourceNode,
): boolean {
  const index = node.sourceIndex;
  return index !== undefined && index > 0 && /\s/u.test(text[index - 1]!);
}

/** Count only whitespace adjoining authored, top-level commas between items. */
export function authoredCommaSpace(
  text: string,
  previous: SelectorSourceNode,
  next: SelectorSourceNode,
): boolean {
  const from = previous.sourceIndex;
  const to = firstSourceIndex(next);
  if (from === undefined || to === undefined) return false;
  return topLevelCommas(text, from, to).some(
    (comma) => triviaLeft(text, comma, from) || triviaRight(text, comma, to),
  );
}

/** Only a wrapper's trailing comma may carry its moved whitespace outward. */
export function wrapperMovedSpace(
  text: string,
  node: SelectorSourceNode,
): boolean {
  if (node.type !== "pseudo" || !node.nodes?.length) return false;
  const selectors = node.nodes;
  const last = selectors.at(-1);
  if (!last) return false;
  if (node.value === ":global" || node.value === ":local") {
    if (selectors.length > 1 && !hasSelector(last)) {
      const open = text.indexOf("(", node.sourceIndex ?? 0);
      const close = groupEnd(text, open);
      if (close < 0) return false;
      const commas = topLevelCommas(text, open + 1, close);
      const comma = commas.at(-1);
      return comma !== undefined && triviaRight(text, comma, close);
    }
  } else if (!hasSelector(last)) return false;
  const final = last.nodes?.filter((child) => child.type !== "comment").at(-1);
  return final ? wrapperMovedSpace(text, final) : false;
}

function hasSelector(node: SelectorSourceNode): boolean {
  return node.nodes?.some((child) => child.type !== "comment") ?? false;
}

function firstSourceIndex(node: SelectorSourceNode): number | undefined {
  return (
    node.nodes?.find((child) => child.type !== "comment")?.sourceIndex ??
    node.sourceIndex
  );
}

function topLevelCommas(text: string, from: number, to: number): number[] {
  const commas: number[] = [];
  const stack: string[] = [];
  for (let index = from; index < to; index += 1) {
    const char = text[index]!;
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      index = skipString(text, index) - 1;
      continue;
    }
    if (text.slice(index, index + 2) === "/*") {
      const end = text.indexOf("*/", index + 2);
      if (end < 0) break;
      index = end + 1;
      continue;
    }
    if (char === "(" || char === "[") stack.push(char);
    else if (char === ")" || char === "]") stack.pop();
    else if (char === "," && !stack.length) commas.push(index);
  }
  return commas;
}

function triviaLeft(text: string, comma: number, from: number): boolean {
  let whitespace = false;
  for (let index = comma - 1; index >= from;) {
    if (/\s/u.test(text[index]!)) {
      whitespace = true;
      index -= 1;
    } else if (text.slice(index - 1, index + 1) === "*/") {
      const start = text.lastIndexOf("/*", index - 1);
      if (start < from) break;
      index = start - 1;
    } else break;
  }
  return whitespace;
}

function triviaRight(text: string, comma: number, to: number): boolean {
  let whitespace = false;
  for (let index = comma + 1; index < to;) {
    if (/\s/u.test(text[index]!)) {
      whitespace = true;
      index += 1;
    } else if (text.slice(index, index + 2) === "/*") {
      const end = text.indexOf("*/", index + 2);
      if (end < 0 || end >= to) break;
      index = end + 2;
    } else break;
  }
  return whitespace;
}

function groupEnd(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      index = skipString(text, index) - 1;
      continue;
    }
    if (text.slice(index, index + 2) === "/*") {
      const end = text.indexOf("*/", index + 2);
      if (end < 0) return -1;
      index = end + 1;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")" && --depth === 0) return index;
  }
  return -1;
}

function skipString(text: string, open: number): number {
  const quote = text[open];
  let index = open + 1;
  while (index < text.length) {
    if (text[index] === "\\") index += 2;
    else if (text[index++] === quote) return index;
  }
  return text.length;
}
