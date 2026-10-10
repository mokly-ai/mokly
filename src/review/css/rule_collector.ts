/** Recover native rules and guard local segment headers, bodies and descendants. */
import type { Rule } from "lightningcss";

import {
  serializeBlock,
  serializePrelude,
  serializeRuleHeader,
  serializeSelector,
} from "./serialization.js";
import { tokenizeCss, type CssSource, type CssSourceRule } from "./source.js";
import { CssRuleParseError } from "./types.js";
import type { CssRule, CssRuleCondition } from "./types.js";

/** Combine the native rule tree with original declaration runs and enclosing contexts. */
export class RuleCollector {
  private interval: { start: number; end: number } | undefined;
  constructor(
    private readonly source: CssSource,
    private readonly output: CssRule[],
  ) {}

  segment(
    rule: Rule,
    interval: { start: number; end: number },
    raw: CssSourceRule,
  ): void {
    this.interval = interval;
    this.rule(rule, [], raw);
  }

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
      if (rule) this.rule(rule, [], sourceRule);
      else if (/^@charset\s/i.test(sourceRule.header))
        this.atRule(sourceRule.header, undefined, []);
      else
        throw new CssRuleParseError({
          kind: "unrepresented-rule",
          offset: token.start,
        });
      end = sourceRule.end;
    }
  }

  private rule(
    rule: Rule,
    conditions: readonly CssRuleCondition[],
    recovered?: CssSourceRule,
  ): void {
    if (
      rule.type === "ignored" ||
      rule.type === "custom" ||
      rule.type === "nested-declarations"
    )
      throw new CssRuleParseError({
        kind: "unsupported-rule",
        rule: rule.type,
      });
    const start = this.source.offset(rule.value.loc);
    if (this.interval && rule.value.loc.source_index !== 0)
      throw new CssRuleParseError({ kind: "segment-descendant-source" });
    const raw = recovered ?? this.source.rule(start);
    this.verify(start, raw.end);
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
      this.append({
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
        raw.body
          ? this.source.text.slice(raw.body.start, raw.body.end)
          : undefined,
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
        this.verify(cursor, until);
        if (this.interval && (until > end || until < cursor))
          throw new CssRuleParseError({ kind: "segment-declaration-boundary" });
        this.append({
          ordinal: this.output.length,
          selectors: ["&"],
          conditions,
          ...serializeBlock(this.source.text.slice(cursor, until)),
        });
        cursor = until;
      } else if ("value" in rule && rule.value) {
        const location = this.source.offset(rule.value.loc);
        const raw = this.source.rule(location);
        if (this.interval) {
          if (location < cursor || raw.end > end)
            throw new CssRuleParseError({ kind: "segment-child-boundary" });
        }
        this.rule(rule, conditions, raw);
        cursor = raw.end;
      } else
        throw new CssRuleParseError({
          kind: "unsupported-rule",
          rule: rule.type,
        });
    }
  }

  private atRule(
    header: string,
    body: string | undefined,
    conditions: readonly CssRuleCondition[],
  ): void {
    const tokens = tokenizeCss(header);
    const name = tokens[1];
    if (tokens[0]?.value !== "@" || !name?.word)
      throw new CssRuleParseError({ kind: "invalid-at-rule-header" });
    this.append({
      ordinal: this.output.length,
      selectors: [],
      atRule: name.value,
      prelude: header.slice(name.end).trim(),
      block: body !== undefined,
      conditions,
      ...serializeBlock(body ?? ""),
    });
  }

  private append(rule: CssRule): void {
    this.output.push(rule);
  }

  private verify(start: number, end: number): void {
    if (
      this.interval &&
      (!Number.isInteger(start) ||
        start < this.interval.start ||
        end > this.interval.end ||
        end < start)
    )
      throw new CssRuleParseError({ kind: "segment-descendant-boundary" });
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
