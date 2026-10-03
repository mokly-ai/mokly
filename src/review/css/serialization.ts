/** Normalize rule material without joining tokens across source boundaries. */
import type { Rule, Selector, StyleRule } from "lightningcss";

import { transform } from "./lightning.js";
import { CssSource, decodeCssIdentifier, tokenizeCss } from "./source.js";
import type { CssSourceToken } from "./source.js";

const printableStyle = {
  loc: { source_index: 0, line: 0, column: 1 },
  selectors: [[{ type: "class", name: "mokly" }]],
  declarations: {
    declarations: [
      {
        property: "color",
        value: { type: "rgb", r: 255, g: 0, b: 0, alpha: 1 },
      },
    ],
  },
  rules: [],
} satisfies StyleRule;

/** Use the native printer for selector syntax, one selector at a time. */
export function serializeSelector(
  selector: Selector,
  style: StyleRule,
): string {
  return serializeRuleHeader({
    type: "style",
    value: {
      ...style,
      selectors: [selector],
      declarations: printableStyle.declarations,
      rules: [],
    },
  });
}

/** Print preludes without evaluating conditions or optimizing away empty rules. */
export function serializeRuleHeader(rule: Rule): string {
  const headerRule =
    "value" in rule &&
    rule.value &&
    "rules" in rule.value &&
    rule.type !== "page" &&
    rule.type !== "style"
      ? ({
          ...rule,
          value: {
            ...rule.value,
            rules: [{ type: "style", value: printableStyle }],
          },
        } as Rule)
      : rule;
  const printed = transform({
    filename: "stylesheet.css",
    code: Buffer.from(""),
    minify: false,
    errorRecovery: false,
    visitor: {
      StyleSheet: (sheet) => ({
        ...sheet,
        rules: [omitNullFields(headerRule) as Rule],
      }),
    },
  });
  const text = Buffer.from(printed.code).toString("utf8");
  return compact(tokenizeCss(new CssSource(text).rule(0).header), "printed");
}

/** The native visitor emits null optionals that its returned-AST decoder requires omitted. */
function omitNullFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitNullFields);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== null)
        .map(([key, item]) => [key, omitNullFields(item)]),
    );
  return value;
}

/** Normalize declaration trivia while retaining order, duplicates, and opaque bodies. */
export function serializeBlock(text: string): {
  declarations: string;
  hasCustomProperties: boolean;
} {
  const source = new CssSource(text);
  const { tokens } = source;
  const parts: string[] = [];
  let start = 0;
  let hasCustomProperties = false;
  const declaration = (end: number): void => {
    const run = tokens.slice(start, end);
    if (!run.length) return;
    hasCustomProperties ||= isCustomProperty(run);
    parts.push(`${compact(run, "declaration")};`);
  };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token.value === "(" || token.value === "[") {
      index = source.closing(index);
    } else if (token.value === ";") {
      declaration(index);
      start = index + 1;
    } else if (token.value === "{") {
      const end = source.closing(index);
      if (isCustomProperty(tokens.slice(start, index))) {
        index = end;
        continue;
      }
      const body = serializeBlock(text.slice(token.end, tokens[end]!.start));
      hasCustomProperties ||= body.hasCustomProperties;
      parts.push(
        `${compact(tokens.slice(start, index), "selector")}{${body.declarations}}`,
      );
      index = end;
      start = index + 1;
    }
  }
  declaration(tokens.length);
  return {
    declarations: parts.join("").replace(/;$/, ""),
    hasCustomProperties,
  };
}

/** Canonical trivia for an opaque at-rule prelude (including encoding statements). */
export function serializePrelude(text: string): string {
  return compact(tokenizeCss(text), "selector");
}

function isCustomProperty(tokens: readonly CssSourceToken[]): boolean {
  const name = tokens[0]?.value ?? "";
  const decoded = decodeCssIdentifier(name);
  return decoded.startsWith("--") && tokens[1]?.value === ":";
}

function compact(
  tokens: readonly CssSourceToken[],
  mode: "declaration" | "selector" | "printed",
): string {
  let result = "";
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const previous = tokens[index - 1];
    if (previous) {
      const separators =
        mode === "declaration" ? ";:,{}!/" : mode === "selector" ? ",>+~=" : "";
      const optional =
        separators.includes(token.value) ||
        separators.includes(previous.value) ||
        token.value === ")" ||
        token.value === "]" ||
        previous.value === "(" ||
        previous.value === "[";
      if (
        (token.spaceBefore && !optional) ||
        (previous.word && token.word) ||
        (previous.value === "/" && token.value === "*") ||
        (token.commentBefore && joinsTokens(previous, token))
      )
        result += " ";
    }
    result += token.value;
  }
  return result;
}

function joinsTokens(before: CssSourceToken, after: CssSourceToken): boolean {
  return (
    (before.word && after.value === "(") ||
    ((before.value === "#" || before.value === "@") && after.word) ||
    ((before.value === "." || before.value === "+") &&
      /^\d/.test(after.value)) ||
    (/^\d/.test(before.value) && (after.value === "." || after.value === "%"))
  );
}
