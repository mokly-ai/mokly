/** Parse stylesheet rules with Lightning CSS while retaining ordered source material. */
import type { Rule } from "lightningcss";

import { transform } from "./lightning.js";
import {
  serializeBlock,
  serializePrelude,
  serializeRuleHeader,
  serializeSelector,
} from "./serialization.js";
import { CssSource, tokenizeCss } from "./source.js";
import { CssRuleParseError } from "./types.js";
import type {
  CssRule,
  CssRuleCondition,
  CssRuleParser,
  CssRuleParseResult,
} from "./types.js";

/** Parse with Lightning CSS before its optimizer can merge rules or declarations. */
export class LightningCssRuleParser implements CssRuleParser {
  parse(stylesheet: string): CssRuleParseResult {
    try {
      const source = new CssSource(
        stylesheet.replace(/^\uFEFF/, "").replace(/\r\n?|\f/g, "\n"),
      );
      const rules: CssRule[] = [];
      transform({
        filename: "stylesheet.css",
        code: Buffer.from(source.text),
        errorRecovery: false,
        visitor: {
          StyleSheet(sheet) {
            const collector = new RuleCollector(source, rules);
            collector.stylesheet(sheet.rules);
          },
        },
      });
      return { status: "parsed", rules };
    } catch (cause) {
      return {
        status: "unresolved",
        error:
          cause instanceof CssRuleParseError
            ? cause
            : new CssRuleParseError(cause),
      };
    }
  }
}

/** Combine the native rule tree with original declaration runs and enclosing contexts. */
class RuleCollector {
  constructor(
    private readonly source: CssSource,
    private readonly output: CssRule[],
  ) {}

  stylesheet(rules: readonly Rule[]): void {
    const byOffset = new Map(
      rules.flatMap((rule) =>
        "value" in rule && rule.value
          ? [[this.source.offset(rule.value.loc), rule] as const]
          : [],
      ),
    );
    let end = 0;
    for (const token of this.source.tokens) {
      if (token.start < end) continue;
      const remaining = this.source.text.slice(token.start);
      const legacyComment = remaining.startsWith("<!--")
        ? 4
        : remaining.startsWith("-->")
          ? 3
          : 0;
      if (legacyComment) {
        end = token.start + legacyComment;
        continue;
      }
      const sourceRule = this.source.rule(token.start);
      const rule = byOffset.get(token.start);
      if (rule) this.rule(rule, []);
      else if (/^@charset\s/i.test(sourceRule.header))
        this.atRule(sourceRule.header, "", []);
      else
        throw new CssRuleParseError({
          kind: "unrepresented-rule",
          offset: token.start,
        });
      end = sourceRule.end;
    }
  }

  private rule(rule: Rule, conditions: readonly CssRuleCondition[]): void {
    if (
      rule.type === "ignored" ||
      rule.type === "custom" ||
      rule.type === "nested-declarations"
    )
      throw new CssRuleParseError({
        kind: "unsupported-rule",
        rule: rule.type,
      });
    const raw = this.source.rule(this.source.offset(rule.value.loc));
    if (rule.type === "style" && raw.body) {
      const selectors = rule.value.selectors.map((selector) =>
        serializeSelector(selector, rule.value),
      );
      const children = rule.value.rules ?? [];
      const first = children[0];
      const end =
        first && "value" in first && first.value
          ? this.source.offset(first.value.loc)
          : raw.body.end;
      this.output.push({
        ordinal: this.output.length,
        selectors,
        conditions,
        ...serializeBlock(this.source.text.slice(raw.body.start, end)),
      });
      this.children(children, end, raw.body.end, [
        ...conditions,
        { kind: "nesting-parent", prelude: selectors.join(", ") },
      ]);
    } else if (isConditionRule(rule) && raw.body && rule.value.rules.length) {
      const kind = rule.type === "layer-block" ? "layer" : rule.type;
      const prelude = serializeRuleHeader(rule)
        .replace(/^@[^\s{(]+/, "")
        .trim();
      this.children(rule.value.rules, raw.body.start, raw.body.end, [
        ...conditions,
        { kind, prelude },
      ]);
    } else {
      const header =
        rule.type === "unknown"
          ? serializePrelude(raw.header)
          : serializeRuleHeader(rule);
      this.atRule(
        header,
        raw.body ? this.source.text.slice(raw.body.start, raw.body.end) : "",
        conditions,
      );
    }
  }

  private children(
    rules: readonly Rule[],
    start: number,
    end: number,
    conditions: readonly CssRuleCondition[],
  ): void {
    let cursor = start;
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index]!;
      if (rule.type === "nested-declarations") {
        const next = rules[index + 1];
        const until =
          next && "value" in next && next.value
            ? this.source.offset(next.value.loc)
            : end;
        this.output.push({
          ordinal: this.output.length,
          selectors: ["&"],
          conditions,
          ...serializeBlock(this.source.text.slice(cursor, until)),
        });
        cursor = until;
      } else if ("value" in rule && rule.value) {
        this.rule(rule, conditions);
        cursor = this.source.rule(this.source.offset(rule.value.loc)).end;
      } else
        throw new CssRuleParseError({
          kind: "unsupported-rule",
          rule: rule.type,
        });
    }
  }

  private atRule(
    header: string,
    body: string,
    conditions: readonly CssRuleCondition[],
  ): void {
    const tokens = tokenizeCss(header);
    const name = tokens[1];
    if (tokens[0]?.value !== "@" || !name?.word)
      throw new CssRuleParseError({ kind: "invalid-at-rule-header" });
    this.output.push({
      ordinal: this.output.length,
      selectors: [],
      atRule: name.value,
      prelude: header.slice(name.end).trim(),
      conditions,
      ...serializeBlock(body),
    });
  }
}

function isConditionRule(
  rule: Rule,
): rule is Extract<
  Rule,
  { type: "media" | "supports" | "container" | "layer-block" }
> {
  return (
    rule.type === "media" ||
    rule.type === "supports" ||
    rule.type === "container" ||
    rule.type === "layer-block"
  );
}
