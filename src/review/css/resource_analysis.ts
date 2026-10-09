/** Cache parser results and retain rule proof until catalogue attribution completes. */
import { isStylesheetPath } from "@mokly/viewer/data";
import type {
  DependencyReason,
  ExcludedResource,
  ResourceEvidence,
} from "@mokly/viewer/data";

import { documentWorkSync } from "../../diagnostics/timings.js";

import { analyzeStylesheetChange } from "./analyze.js";
import { ByteBoundedLru } from "./byte_lru.js";
import { diffCssRules } from "./diff.js";
import { detachParseResult } from "./parse_cache.js";
import {
  CssAttribution,
  outputMatch,
  type CollectedCssRule,
} from "./attribution.js";
import type { CssMatchingPair } from "./containment.js";
import { CssRuleIdentities } from "./identity.js";
import { matchCssRules } from "./match.js";
import { LightningCssRuleParser } from "./rules.js";
import { CssSegmentAnalysis } from "./segment_analysis.js";
import {
  CssRuleParseError,
  type CssRuleParser,
  type CssRuleParseResult,
} from "./types.js";

/** Resource bytes are supplied only after confinement and changed-path checks. */
export interface ChangedResource {
  path: string;
  before?: string;
  after?: string;
}

export interface ResourceMatchingPair extends CssMatchingPair {
  /** The stylesheets that apply in this document; omitted for standalone callers. */
  paths?: ReadonlySet<string>;
}

export class CssResourceAnalysis {
  private readonly parsed: ByteBoundedLru<CssRuleParseResult>;
  readonly parser: CssRuleParser;
  private readonly identities = new CssRuleIdentities();
  readonly attribution = new CssAttribution();

  constructor(
    parser: CssRuleParser = new LightningCssRuleParser(),
    private readonly matcher: typeof matchCssRules = matchCssRules,
    cacheBytes?: number,
  ) {
    this.parsed = new ByteBoundedLru(detachParseResult, cacheBytes);
    const whole: CssRuleParser = {
      parse: (source) => this.parseWhole(parser, source),
      ...(parser.parseSegments
        ? {
            parseSegments: (segments: readonly string[]) =>
              parser.parseSegments!(segments),
          }
        : {}),
    };
    const inline = new CssSegmentAnalysis(whole, cacheBytes);
    this.parser = {
      parse: whole.parse,
      parseInlineRuns: (source) => inline.parseRuns(source),
    };
  }

  private parseWhole(
    parser: CssRuleParser,
    source: string,
  ): CssRuleParseResult {
    let result = this.parsed.get(source);
    if (!result) {
      try {
        result = documentWorkSync("inlineRuleMs", () => parser.parse(source));
      } catch (cause) {
        result = { status: "unresolved", error: new CssRuleParseError(cause) };
      }
      result = this.parsed.set(source, result);
    }
    return result;
  }

  analyze(
    resources: readonly ChangedResource[],
    documents: readonly ResourceMatchingPair[],
  ): ResourceEvidence {
    const reasons: DependencyReason[] = [];
    const excludedResources: ExcludedResource[] = [];
    for (const resource of [...resources].sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    )) {
      if (!isStylesheetPath(resource.path)) {
        reasons.push({ kind: "dependency", path: resource.path });
        continue;
      }
      let rules: CollectedCssRule[];
      try {
        rules = this.rules(resource, documents);
      } catch {
        rules = [
          {
            status: "unresolved",
            selectors: this.changedSelectors(resource),
            matches: [],
          },
        ];
      }
      if (rules.length)
        reasons.push({
          kind: "dependency",
          path: resource.path,
          analysis: this.attribution.record(rules),
        });
      else
        excludedResources.push({
          path: resource.path,
          reason: "no-matching-rule",
        });
    }
    return {
      ...(reasons.length ? { reasons } : {}),
      ...(excludedResources.length ? { excludedResources } : {}),
    };
  }

  private rules(
    resource: ChangedResource,
    documents: readonly ResourceMatchingPair[],
  ): CollectedCssRule[] {
    const result: CollectedCssRule[] = [];
    for (const pair of documents.length ? documents : [{}]) {
      if (pair.paths && !pair.paths.has(resource.path)) continue;
      const analysed = analyzeStylesheetChange(
        resource.before ?? "",
        resource.after ?? "",
        pair,
        this.parser,
        this.matcher,
      );
      if (analysed.kind === "excluded") continue;
      if (!analysed.rules.length)
        return [
          { status: "unresolved", selectors: analysed.selectors, matches: [] },
        ];
      for (const { change, outcome, matches } of analysed.rules) {
        if (outcome.kind === "excluded") continue;
        result.push({
          ruleKey: this.identities.key(change),
          status: outcome.status,
          selectors: outcome.selectors,
          matches:
            outcome.status === "matched"
              ? matches.map((match) => outputMatch(match, pair))
              : [],
        });
      }
    }
    return result;
  }
  /** Recover serialized changed selectors without allowing a second failure to escape. */
  private changedSelectors(resource: ChangedResource): readonly string[] {
    try {
      const diff = diffCssRules(
        resource.before ?? "",
        resource.after ?? "",
        this.parser,
      );
      if (diff.status === "unresolved") return [];
      return [
        ...new Set(
          [
            ...diff.added,
            ...diff.removed,
            ...diff.changed.flatMap(({ before, after }) => [before, after]),
          ].flatMap((rule) => rule.selectors),
        ),
      ].sort();
    } catch {
      return [];
    }
  }
}
