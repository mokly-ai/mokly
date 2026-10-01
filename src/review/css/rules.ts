/** Parse and verify native source roots before any optimizer runs. */
import { transform } from "./lightning.js";
import { RuleCollector } from "./rule_collector.js";
import { cssRuleIdentity } from "./rule_identity.js";
import { CssSource, normalizeCssSource } from "./source.js";
import { CssRuleParseError } from "./types.js";
import type {
  CssRule,
  CssRuleParser,
  CssRuleParseResult,
  CssSegmentRun,
} from "./types.js";

export class LightningCssRuleParser implements CssRuleParser {
  constructor(private readonly nativeTransform: typeof transform = transform) {}

  parse(stylesheet: string): CssRuleParseResult {
    try {
      const source = new CssSource(normalizeCssSource(stylesheet));
      const rules: CssRule[] = [];
      this.nativeTransform({
        filename: "stylesheet.css",
        code: Buffer.from(source.text),
        errorRecovery: false,
        visitor: {
          StyleSheet(sheet) {
            new RuleCollector(source, rules).stylesheet(sheet.rules);
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

  parseSegments(
    segments: readonly string[],
  ): readonly CssSegmentRun[] | undefined {
    try {
      let offset = 0;
      const intervals = segments.map((text) => {
        const start = offset;
        offset += text.length + 1;
        return { start, end: offset - 1 };
      });
      const source = new CssSource(segments.join("\n"));
      const runs: CssSegmentRun[] = [];
      this.nativeTransform({
        filename: "stylesheet.css",
        code: Buffer.from(source.text),
        errorRecovery: false,
        visitor: {
          StyleSheet(sheet) {
            if (sheet.rules.length !== intervals.length)
              throw new CssRuleParseError({ kind: "segment-root-count" });
            for (const [index, root] of sheet.rules.entries()) {
              const interval = intervals[index]!;
              if (
                !("value" in root) ||
                !root.value ||
                root.value.loc.source_index !== 0 ||
                source.offset(root.value.loc) !== interval.start
              )
                throw new CssRuleParseError({ kind: "segment-root-location" });
              const raw = source.rule(interval.start);
              if (
                raw.end !== interval.end ||
                ![";", "}"].includes(source.text[raw.end - 1]!)
              )
                throw new CssRuleParseError({ kind: "segment-root-boundary" });
              const rules: CssRule[] = [];
              new RuleCollector(source, rules).segment(root, interval);
              runs.push({
                rules,
                identityRunKey: JSON.stringify(rules.map(cssRuleIdentity)),
              });
            }
          },
        },
      });
      return runs;
    } catch {
      return undefined;
    }
  }
}
