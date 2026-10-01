/** Reuse verified inline runs; every uncertain batch falls back as one element. */
import {
  documentWorkSync,
  timingDocumentWork,
} from "../../diagnostics/timings.js";

import { ByteBoundedLru } from "./byte_lru.js";
import { parseCssRules } from "./diff.js";
import { detachSegmentRun } from "./parse_cache.js";
import { rebaseCssRule } from "./rule_identity.js";
import { scanCssSegments } from "./segments.js";
import { decodeCssIdentifier } from "./source.js";
import type {
  CssRule,
  CssRuleParser,
  CssRuleParseResult,
  CssSegmentRun,
} from "./types.js";

export class CssSegmentAnalysis {
  private readonly cache: ByteBoundedLru<CssSegmentRun>;

  constructor(
    private readonly parser: CssRuleParser,
    cacheBytes?: number,
  ) {
    this.cache = new ByteBoundedLru(detachSegmentRun, cacheBytes);
  }

  parse(source: string, ordinalBase = 0): CssRuleParseResult {
    return documentWorkSync("inlineRuleMs", () =>
      this.element(source, ordinalBase),
    );
  }

  private element(source: string, ordinalBase: number): CssRuleParseResult {
    const counts = timingDocumentWork()?.inlineStyles;
    if (counts) counts.elements++;
    const fallback = () => {
      if (counts) counts.fallbacks++;
      return parseCssRules(this.parser, source);
    };
    const scan = scanCssSegments(source);
    if (scan.status === "anomaly") return fallback();
    if (counts) counts.segments += scan.segments.length;
    const texts = scan.segments.map(({ start, end }) =>
      scan.source.slice(start, end),
    );
    const resolved = new Map<string, CssSegmentRun>();
    const missing = new Set<string>();
    let duplicates = 0;
    for (const text of texts) {
      const hit = this.cache.get(text);
      if (hit) {
        resolved.set(text, hit);
        if (counts) counts.segmentHits++;
      } else if (missing.has(text)) duplicates++;
      else missing.add(text);
    }
    if (texts.some(contextual) || (missing.size && !this.parser.parseSegments))
      return fallback();
    if (missing.size) {
      const batch = [...missing];
      if (counts) counts.segmentParses += batch.length;
      let runs: readonly CssSegmentRun[] | undefined;
      try {
        runs = this.parser.parseSegments!(batch);
      } catch {
        return fallback();
      }
      if (!runs || runs.length !== batch.length) return fallback();
      for (const [index, text] of batch.entries())
        resolved.set(text, this.cache.set(text, runs[index]!));
      if (counts) counts.segmentHits += duplicates;
    }
    const rules: CssRule[] = [];
    for (const text of texts)
      for (const rule of resolved.get(text)!.rules)
        rules.push(rebaseCssRule(rule, ordinalBase + rules.length));
    return { status: "parsed", rules };
  }
}

function contextual(text: string): boolean {
  const name =
    /^@((?:\\(?:[a-f\d]{1,6}[\t\n\f\r ]?|[\s\S])|[\w\-\u0080-\uFFFF])+)/i.exec(
      text,
    )?.[1];
  return (
    name !== undefined &&
    ["charset", "import", "namespace"].includes(
      decodeCssIdentifier(name).toLowerCase(),
    )
  );
}
