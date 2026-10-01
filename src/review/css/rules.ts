/** Parse and verify native source roots before any optimizer runs. */
import { transform } from "./lightning.js";
import { detachSegmentRun } from "./parse_cache.js";
import { RuleCollector } from "./rule_collector.js";
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
    if (!segments.length) return [];
    try {
      let offset = 0;
      const intervals = segments.map((text) => {
        const start = offset;
        offset += text.length + 1;
        return { start, end: offset - 1 };
      });
      const sentinelStart = offset;
      const source = new CssSource(
        `${segments.join("\n")}\n@mokly-segment-end;`,
      );
      const runs: CssSegmentRun[] = [];
      this.nativeTransform({
        filename: "stylesheet.css",
        code: Buffer.from(source.text),
        errorRecovery: false,
        visitor: {
          StyleSheet(sheet) {
            if (sheet.rules.length !== intervals.length + 1)
              throw new CssRuleParseError({ kind: "segment-root-count" });
            const sentinel = sheet.rules.at(-1)!;
            if (
              !("value" in sentinel) ||
              !sentinel.value ||
              sentinel.value.loc.source_index !== 0 ||
              source.offset(sentinel.value.loc) !== sentinelStart
            )
              throw new CssRuleParseError({ kind: "segment-end-location" });
            for (const [index, root] of sheet.rules.slice(0, -1).entries()) {
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
              new RuleCollector(source, rules).segment(root, interval, raw);
              runs.push(detachSegmentRun({ rules, identityRunKey: "" }).value);
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
