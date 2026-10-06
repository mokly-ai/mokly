import {
  CSS_COMMENT,
  CSS_NORMAL,
  CSS_WHITESPACE,
  cssWhitespaceAt,
  type CssScan,
} from "./module_css_scan.js";

/** Selector-parser positions refer to the authored selector, not its printed form. */
export interface SelectorSourceNode {
  readonly type: string;
  readonly value?: string;
  readonly sourceIndex?: number;
  readonly nodes?: readonly SelectorSourceNode[];
}

/** Count only unconsumed CSS whitespace adjoining authored top-level commas. */
export function authoredCommaSpace(
  scan: CssScan,
  previous: SelectorSourceNode,
  next: SelectorSourceNode,
): boolean {
  const from = previous.sourceIndex;
  const to = firstSourceIndex(next);
  if (from === undefined || to === undefined) return false;
  return topLevelCommas(scan, from, to).some(
    (comma) => triviaLeft(scan, comma, from) || triviaRight(scan, comma, to),
  );
}

/** Only a wrapper's empty tail may carry its whitespace outward. */
export function wrapperMovedSpace(
  scan: CssScan,
  node: SelectorSourceNode,
): boolean {
  if (node.type !== "pseudo" || !node.nodes?.length) return false;
  const selectors = node.nodes;
  const lastNonempty = selectors.findLastIndex(hasSelector);
  if (lastNonempty < 0) return false;
  const last = selectors.at(-1)!;
  if (node.value === ":global" || node.value === ":local") {
    if (lastNonempty < selectors.length - 1) {
      const open = (node.sourceIndex ?? 0) + node.value.length;
      const close = groupEnd(scan, open);
      if (close < 0) return false;
      const comma = topLevelCommas(scan, open + 1, close)[lastNonempty];
      if (comma === undefined) return false;
      for (let index = comma + 1; index < close; index += 1)
        if (cssWhitespaceAt(scan, index)) return true;
      return false;
    }
  } else if (!hasSelector(last)) return false;
  const final = last.nodes?.at(-1);
  return final ? wrapperMovedSpace(scan, final) : false;
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

function topLevelCommas(scan: CssScan, from: number, to: number): number[] {
  const commas: number[] = [];
  const stack: string[] = [];
  for (let index = from; index < to; index += 1) {
    if (scan.kinds[index] !== CSS_NORMAL) continue;
    const character = scan.text[index]!;
    if (character === "(" || character === "[") stack.push(character);
    else if (character === ")" || character === "]") stack.pop();
    else if (character === "," && !stack.length) commas.push(index);
  }
  return commas;
}

function triviaLeft(scan: CssScan, comma: number, from: number): boolean {
  let whitespace = false;
  for (let index = comma - 1; index >= from; index -= 1) {
    const kind = scan.kinds[index];
    if (kind === CSS_WHITESPACE) whitespace = true;
    else if (kind !== CSS_COMMENT) break;
  }
  return whitespace;
}

function triviaRight(scan: CssScan, comma: number, to: number): boolean {
  let whitespace = false;
  for (let index = comma + 1; index < to; index += 1) {
    const kind = scan.kinds[index];
    if (kind === CSS_WHITESPACE) whitespace = true;
    else if (kind !== CSS_COMMENT) break;
  }
  return whitespace;
}

function groupEnd(scan: CssScan, open: number): number {
  let depth = 0;
  for (let index = open; index < scan.text.length; index += 1) {
    if (scan.kinds[index] !== CSS_NORMAL) continue;
    const character = scan.text[index];
    if (character === "(") depth += 1;
    else if (character === ")" && --depth === 0) return index;
  }
  return -1;
}
