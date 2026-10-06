import { createRequire } from "node:module";

interface ValueNode {
  readonly type: string;
  readonly value: string;
  readonly nodes?: readonly ValueNode[];
  readonly before?: string;
  readonly after?: string;
  readonly quote?: string;
}

interface ParsedValue {
  readonly nodes: readonly ValueNode[];
}

type ValueParser = (text: string) => ParsedValue;

const requireValueParser = createRequire(import.meta.url);
let parser: ValueParser | undefined;

/** Compare CSS value tokens, allowing only exact scoped identifier substitutions. */
export function moduleValuesMatch(
  input: string,
  output: string,
  prefix: string,
): boolean {
  if (input === output) return true;
  try {
    parser ??= requireValueParser("postcss-value-parser") as ValueParser;
    return sameNodes(parser(input).nodes, parser(output).nodes, prefix);
  } catch {
    return false;
  }
}

/** CSS identifier word eligible for a one-to-one scoped-name substitution. */
export function validModuleIdentifier(word: string): boolean {
  return /^-?(?:[_a-zA-Z]|\p{L})(?:[-_a-zA-Z0-9]|\p{L}|\p{N})*$/u.test(word);
}

export function scopedWordMatches(
  input: string,
  output: string,
  prefix: string,
): boolean {
  return (
    output === input ||
    (validModuleIdentifier(input) && output === `${prefix}${input}`)
  );
}

function sameNodes(
  input: readonly ValueNode[],
  output: readonly ValueNode[],
  prefix: string,
): boolean {
  if (input.length !== output.length) return false;
  return input.every((token, index) => {
    const changed = output[index]!;
    if (
      token.type === "function" &&
      (token.value === "global" || token.value === "local") &&
      token.nodes?.length === 1 &&
      token.nodes[0]?.type === "word" &&
      changed.type === "word"
    )
      return scopedWordMatches(token.nodes[0]!.value, changed.value, prefix);
    if (token.type !== changed.type) return false;
    if (token.type === "space") return true;
    if (token.type === "word")
      return scopedWordMatches(token.value, changed.value, prefix);
    if (token.value !== changed.value) return false;
    if (token.type === "string") return token.quote === changed.quote;
    if (token.type === "div")
      return (
        Boolean(token.before) === Boolean(changed.before) &&
        Boolean(token.after) === Boolean(changed.after)
      );
    if (token.type === "function")
      return sameNodes(token.nodes ?? [], changed.nodes ?? [], prefix);
    return true;
  });
}
